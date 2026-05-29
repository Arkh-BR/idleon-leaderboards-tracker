// Refresh the bundled hypothetical Effective-Level trees in
// lib/talentsLevel/topTalents.ts by fetching each top player's save and
// running OUR talent engine on the Health Booster (talent 0 — a plain
// simple talent, no cap-booster, so its Effective Level subtree is the
// generic template every simple talent shares).
//
// We compute that talent on every char of every top player, keep the BEST
// value of EVERY node in its Effective Level subtree (best-per-path, full
// depth), and emit CorganNode trees: the hypothetical-max Effective Level
// with complete sub-trees. The /talents "Hypothetical" tab renders it
// straight. Effective Level itself = best base + bonus + super.
//
// ── Per class ──────────────────────────────────────────────────────────
// The reference must match the SELECTED char's class. The only thing in
// the Health Booster Effective Level that differs by class is the Mage
// family bonus (Talent 68): on an Elemental Sorcerer char it gets the
// Family Guy (Talent 144) self-buff, inflating it; on any other class it
// stays unbuffed. Every other source (caps, ATL chain, super levels) is
// account-wide and identical regardless of which char computes it.
//
// So we build TWO pools, each best-per-path across the scanned players:
//   • non-ES (DEFAULT) — Family Bonus 68 unbuffed; the reference for every
//     non-Elemental-Sorcerer class.
//   • ES (OVERRIDE)    — Family Bonus 68 buffed by the char's own Family
//     Guy; the reference when the selected char IS an Elemental Sorcerer.
// Account-wide sources are read from the same accounts in both pools, so
// they land on the same max in each — only the FB68 branch diverges.
//
// Run:  npx tsx web/scripts/update-top-talents.ts
// Knobs: --limit N   cap candidate set (smoke test)
//        --slow       1500ms between players
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeTalentTreesForChars } from "../lib/talentsLevel/compute";
import { flattenTree, nodePath } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";
import { getCharClassKey } from "../lib/talentsLevel/charClass";
import type { CorganNode } from "../lib/corgan/node";

const HEALTH_BOOSTER = 0; // plain simple talent, no cap-booster
const ES_CLASS_KEY = "Elemental_Sorcerer";

const argv = process.argv.slice(2);
const SLOW = argv.includes("--slow");
const THROTTLE_MS = SLOW ? 1500 : 400;
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
})();

const OUTPUT_FILE = join(__dirname, "..", "lib", "talentsLevel", "topTalents.ts");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const childByName = (n: CorganNode | undefined, name: string) =>
  n?.children?.find((c) => c.name === name);

// Walk a tree and overwrite each node's val with the best value seen for
// its path (same nodePath scheme flattenTree uses).
function applyBestVals(
  node: CorganNode,
  best: Record<string, number>,
  parentPath: string,
  siblings: CorganNode[],
  idx: number
) {
  const path = nodePath(parentPath, node, siblings, idx);
  if (best[path] !== undefined) node.val = best[path];
  const kids = node.children || [];
  for (let i = 0; i < kids.length; i++) {
    applyBestVals(kids[i], best, path, kids, i);
  }
}

// A best-per-path accumulator + the highest-effective structure tree seen,
// for one class pool (ES or non-ES).
type Pool = {
  best: Record<string, number>;
  structure: CorganNode | null;
  structEff: number;
  chars: number;
};
const newPool = (): Pool => ({ best: {}, structure: null, structEff: -1, chars: 0 });

// Fold one Health Booster Effective Level tree into a pool.
function foldIntoPool(pool: Pool, tree: CorganNode) {
  if (!childByName(tree, "Effective Level")) return false;
  const flat = flattenTree(tree);
  for (const path in flat) {
    const v = flat[path];
    if (pool.best[path] === undefined || v > pool.best[path]) pool.best[path] = v;
  }
  const eff = Number(childByName(tree, "Effective Level")?.val) || 0;
  if (eff > pool.structEff) {
    pool.structEff = eff;
    pool.structure = tree;
  }
  pool.chars++;
  return true;
}

const FB68_PREFIX = "Family Bonus 68"; // node name "Family Bonus 68 (Mage)"

// Recompute the additive parents we surface: Bonus Levels = Σ direct
// sources (each maxed independently, so the parent ≠ stored sum), and
// Effective Level = Base + Bonus + Super.
function recomputeEff(eff: CorganNode) {
  const bonusNode = childByName(eff, "Bonus Levels");
  if (bonusNode?.children) {
    bonusNode.val = bonusNode.children.reduce(
      (s, c) => s + (Number(c.val) || 0),
      0
    );
  }
  const v = (n: string) => Number(childByName(eff, n)?.val) || 0;
  eff.val = v("Base Level") + v("Bonus Levels") + v("Super Levels");
}

// Stamp the best-per-path values onto a pool's structure tree and pull out
// the recomputed Effective Level node.
function finalizePool(pool: Pool, label: string): CorganNode | null {
  if (!pool.structure) return null;
  applyBestVals(pool.structure, pool.best, "", [pool.structure], 0);
  const eff = childByName(pool.structure, "Effective Level");
  if (!eff) {
    console.error(`× ${label} structure tree has no Effective Level`);
    return null;
  }
  recomputeEff(eff);
  return eff;
}

// Build the Elemental-Sorcerer reference. The only class-dependent node in
// the Health Booster Effective Level is the Mage family bonus (Talent 68):
// on an ES char its own Family Guy (Talent 144) self-buffs it. Every other
// source is account-wide — so we take the (account-wide-maxed) non-ES
// DEFAULT tree and graft in the best-per-path BUFFED FB68 branch from the
// scanned ES chars. This keeps the rich account-wide maxes (the non-ES pool
// has far more chars to draw from) while applying the ES-only buff, so the
// ES reference is always ≥ the non-ES one — never undercounted by sparse
// ES sampling.
function buildESEff(defaultEff: CorganNode, esPool: Pool): CorganNode | null {
  if (!esPool.structure) return null;
  applyBestVals(esPool.structure, esPool.best, "", [esPool.structure], 0);
  const esSrcEff = childByName(esPool.structure, "Effective Level");
  const esBonus = esSrcEff ? childByName(esSrcEff, "Bonus Levels") : null;
  const esFB68 = esBonus?.children?.find((c) =>
    c.name.startsWith(FB68_PREFIX)
  );
  if (!esFB68) {
    console.error("× ES structure has no Family Bonus 68 node");
    return null;
  }
  // Clone the default Effective Level and swap its (unbuffed) FB68 child for
  // the buffed ES one, then recompute the additive parents.
  const esEff: CorganNode = JSON.parse(JSON.stringify(defaultEff));
  const bonus = childByName(esEff, "Bonus Levels");
  if (!bonus?.children) return null;
  const fb68Clone: CorganNode = JSON.parse(JSON.stringify(esFB68));
  const idx = bonus.children.findIndex((c) => c.name.startsWith(FB68_PREFIX));
  if (idx >= 0) bonus.children[idx] = fb68Clone;
  else bonus.children.push(fb68Clone);
  recomputeEff(esEff);
  return esEff;
}

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates({ limit: LIMIT ?? undefined });
  console.log(`  ✓ ${candidates.length} candidates`);

  const nonES = newPool(); // DEFAULT pool — every non-Elemental-Sorcerer class
  const es = newPool(); //    OVERRIDE pool — Elemental Sorcerer chars only
  let scanned = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const tag = `[${i + 1}/${candidates.length}]`;
    process.stdout.write(`  ${tag} ${name.padEnd(20)}`);
    const save = await fetchProfileSave(name);
    if (!save) {
      console.log("  · skipped (no save)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let chars: { charIndex: number }[] = [];
    try {
      chars = listCharacters(save);
    } catch {
      console.log("  · skipped (parse)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    // Health Booster exists on every class's base tab, so compute it on
    // every char (single save load) and bucket the result by class — ES
    // chars feed the ES pool (FB68 buffed by Family Guy), everyone else
    // feeds the non-ES default pool (FB68 unbuffed).
    const jobs = chars.map((ch) => ({
      charIdx: ch.charIndex,
      talentIds: [HEALTH_BOOSTER],
    }));
    // Hypothetical tab always counts the Spelunk Super Talent bonus, so
    // resolve the Health Booster as if it were the active super talent.
    const results = computeTalentTreesForChars(save, jobs, {
      forceSuperActive: true,
    });
    let touched = 0;
    for (const { charIdx, trees } of results) {
      const tree = trees.get(HEALTH_BOOSTER);
      if (!tree) continue;
      const isES = getCharClassKey(save, charIdx) === ES_CLASS_KEY;
      if (foldIntoPool(isES ? es : nonES, tree)) touched++;
    }
    scanned++;
    console.log(`  ✓ ${touched} chars`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  const defaultEff = finalizePool(nonES, "non-ES");
  if (!defaultEff) {
    console.error("× no non-ES Health Booster tree collected, aborting");
    process.exit(1);
  }
  const esEff = buildESEff(defaultEff, es);

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · non-ES chars: ${nonES.chars} → Effective Level ${defaultEff.val}`);
  if (esEff) {
    console.log(`  · ES chars:     ${es.chars} → Effective Level ${esEff.val}`);
  } else {
    console.log("  · ES chars:     0 (no ES override emitted)");
  }

  emitFile(defaultEff, esEff, scanned);
}

function emitFile(
  defaultTree: CorganNode,
  esTree: CorganNode | null,
  scanned: number
) {
  const now = new Date().toISOString();
  const overrides: Record<string, CorganNode> = {};
  if (esTree) overrides[ES_CLASS_KEY] = esTree;
  const lines: string[] = [
    "// Hypothetical-max Effective Level trees (full depth) — the best value",
    "// of every node across the scanned top players, computed on the Health",
    "// Booster (a plain simple talent, so its Effective Level subtree is the",
    "// template every simple talent shares). Effective Level = best base +",
    "// bonus + super. Rendered as-is by the /talents Hypothetical tab.",
    "//",
    "// Two pools, keyed by the selected char's class:",
    "//   HYPO_DEFAULT_TREE      — non-Elemental-Sorcerer reference (Family",
    "//                            Bonus 68 unbuffed).",
    "//   HYPO_TREE_OVERRIDES    — per-class overrides; Elemental_Sorcerer",
    "//                            gets FB68 buffed by its own Family Guy.",
    "// Every other source is account-wide, so non-ES classes share the",
    "// default tree (they would all resolve to identical numbers anyway).",
    "// Auto-refreshed by scripts/update-top-talents.ts.",
    "//",
    `// Snapshot generated: ${now}`,
    `// Players scanned: ${scanned}`,
    "",
    'import type { CorganNode } from "../corgan/node";',
    "",
    `export const HYPO_TALENTS_GENERATED_AT = ${JSON.stringify(now)};`,
    `export const HYPO_TALENTS_PLAYERS_SCANNED = ${scanned};`,
    "",
    `export const HYPO_DEFAULT_TREE: CorganNode = ${JSON.stringify(defaultTree, null, 2)};`,
    "",
    `export const HYPO_TREE_OVERRIDES: Record<string, CorganNode> = ${JSON.stringify(overrides, null, 2)};`,
    "",
    "/** Pick the hypothetical-max Effective Level tree for a class key —",
    " *  the per-class override when one exists, else the non-ES default. */",
    "export function hypoTreeForClass(classKey: string | null): CorganNode {",
    "  return (classKey && HYPO_TREE_OVERRIDES[classKey]) || HYPO_DEFAULT_TREE;",
    "}",
    "",
  ];
  writeFileSync(OUTPUT_FILE, lines.join("\n"));
  console.log(`\n✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
