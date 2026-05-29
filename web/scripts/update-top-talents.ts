// Refresh the bundled hypothetical Effective-Level tree in
// lib/talentsLevel/topTalents.ts by fetching each top player's save and
// running OUR talent engine on the Health Booster (talent 0 — a plain
// simple talent, no cap-booster, so its Effective Level subtree is the
// generic template every simple talent shares).
//
// We compute that talent on every char of every top player, keep the BEST
// value of EVERY node in its Effective Level subtree (best-per-path, full
// depth), and emit a single CorganNode tree: the hypothetical-max Effective
// Level with complete sub-trees. The /talents "Hypothetical" tab renders it
// straight. Effective Level itself = best base + bonus + super.
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

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates({ limit: LIMIT ?? undefined });
  console.log(`  ✓ ${candidates.length} candidates`);

  const best: Record<string, number> = {};
  let structure: CorganNode | null = null; // tree with the highest effective
  let structEff = -1;
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
    // every char (single save load) and keep the best per path.
    // Skip Elemental Sorcerer chars: computing on the ES applies the Family
    // Guy self-buff to the Mage family bonus (the ES IS the family-bonus
    // owner), which inflates the hypothetical artificially. Non-ES chars get
    // the clean, unbuffed family bonus.
    const jobs = chars
      .filter((ch) => {
        const k = getCharClassKey(save, ch.charIndex);
        return k && k !== "Elemental_Sorcerer";
      })
      .map((ch) => ({ charIdx: ch.charIndex, talentIds: [HEALTH_BOOSTER] }));
    // Hypothetical tab always counts the Spelunk Super Talent bonus, so
    // resolve the Health Booster as if it were the active super talent.
    const results = computeTalentTreesForChars(save, jobs, {
      forceSuperActive: true,
    });
    let touched = 0;
    for (const { trees } of results) {
      const tree = trees.get(HEALTH_BOOSTER);
      if (!tree) continue;
      if (!childByName(tree, "Effective Level")) continue;
      const flat = flattenTree(tree);
      for (const path in flat) {
        const v = flat[path];
        if (best[path] === undefined || v > best[path]) best[path] = v;
      }
      const eff = Number(childByName(tree, "Effective Level")?.val) || 0;
      if (eff > structEff) {
        structEff = eff;
        structure = tree;
      }
      touched++;
    }
    scanned++;
    console.log(`  ✓ ${touched} chars`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  if (!structure) {
    console.error("× no Health Booster tree collected, aborting");
    process.exit(1);
  }

  // Stamp the best-per-path values onto the structure tree, then recompute
  // Effective Level = base + bonus + super and isolate that subtree.
  applyBestVals(structure, best, "", [structure], 0);
  const eff = childByName(structure, "Effective Level");
  if (!eff) {
    console.error("× structure tree has no Effective Level, aborting");
    process.exit(1);
  }
  const v = (n: string) => Number(childByName(eff, n)?.val) || 0;
  eff.val = v("Base Level") + v("Bonus Levels") + v("Super Levels");

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · hypothetical Effective Level: ${eff.val}`);

  emitFile(eff, scanned);
}

function emitFile(tree: CorganNode, scanned: number) {
  const now = new Date().toISOString();
  const lines: string[] = [
    "// Hypothetical-max Effective Level tree (full depth) — the best value of",
    "// every node across the scanned top players, computed on the Health",
    "// Booster (a plain simple talent, so its Effective Level subtree is the",
    "// template every simple talent shares). Effective Level = best base +",
    "// bonus + super. Rendered as-is by the /talents Hypothetical tab.",
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
    `export const HYPO_EFFECTIVE_TREE: CorganNode = ${JSON.stringify(tree, null, 2)};`,
    "",
  ];
  writeFileSync(OUTPUT_FILE, lines.join("\n"));
  console.log(`\n✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
