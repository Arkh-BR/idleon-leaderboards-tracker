// Refresh the bundled top-player Coin Multi reference in
// lib/coinMulti/topCoinMulti.ts (+ .meta.ts). Same model as update-top-dr.ts:
// every char of every candidate at map 301 (world 7 for the guild term),
// the best value per source across everyone, then ONE combine() pass — the
// tree and the total come from the same math a real save uses. Class talents
// are gated per class.
//
// Run (from web/):  npx tsx scripts/update-top-coin.ts   [--limit N] [--slow]
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeArkhCoinPools, combineCoinPools } from "../lib/arkh/computeCoin";
import { COIN_ROOT } from "../lib/arkh/stats/defs/coin-multi";
import type { Pool } from "../lib/arkh/stats/tree-builder";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";
import { allClassKeys, profileKey } from "./_shared/classGating";
import { deriveGatedCoinTalents } from "./_shared/coinClassGating";

const argv = process.argv.slice(2);
const THROTTLE_MS = argv.includes("--slow") ? 1500 : 400;
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
})();
// Never publish a shrunken reference (the Tome cron lesson); --limit is a smoke test.
const MIN_PLAYERS = LIMIT ? 1 : 20;
// The map feeds the guild world (⌊map/50⌋ + 1) and talent 643's multikill
// tier. 301 (w7a1) is W7's first fighting map; 300 is a town (tier 1).
const BEST_MAP = 301;

const OUTPUT_FILE = join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.ts");
const META_FILE = join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.meta.ts");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Best = { player: string; char: string; total: number };

function mergeBest(acc: Record<string, Pool> | null, incoming: Record<string, Pool>): Record<string, Pool> {
  if (!acc) {
    const init: Record<string, Pool> = {};
    for (const pn in incoming) init[pn] = { items: [...incoming[pn].items], sum: 0, product: 0 };
    return init;
  }
  for (const pn in incoming) {
    const inc = incoming[pn];
    if (!acc[pn]) {
      acc[pn] = { items: [...inc.items], sum: 0, product: 0 };
      continue;
    }
    const cur = acc[pn];
    const n = Math.min(cur.items.length, inc.items.length);
    for (let i = 0; i < n; i++) {
      if ((Number(inc.items[i].val) || 0) > (Number(cur.items[i].val) || 0)) cur.items[i] = inc.items[i];
    }
  }
  return acc;
}

/** Best pools with some class talents zeroed → one combine() → flat map. */
function profileFlat(best: Record<string, Pool>, zeroTalentIds: number[]): Record<string, number> {
  const clone: Record<string, Pool> = {};
  for (const pn in best) {
    const items = best[pn].items.map((it) =>
      zeroTalentIds.some((id) => it.name.endsWith(`(Talent ${id})`)) ? { ...it, val: 0 } : { ...it }
    );
    let sum = 0;
    let product = 1;
    for (const it of items) {
      const v = Number(it.val) || 0;
      sum += v;
      product *= v !== 0 ? v : 1;
    }
    clone[pn] = { items, sum, product };
  }
  const combined = combineCoinPools(clone);
  const flat = flattenTree(combined.tree);
  flat[COIN_ROOT] = combined.total;
  return flat;
}

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates({ limit: LIMIT ?? undefined, focusBoard: "cashMulti" });
  console.log(`  ✓ ${candidates.length} candidates`);

  let bestPools: Record<string, Pool> | null = null;
  let bestTotal: Best | null = null;
  let scanned = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    process.stdout.write(`  [${i + 1}/${candidates.length}] ${name.padEnd(20)}`);
    const save = await fetchProfileSave(name);
    let chars: { charIndex: number; charName: string }[] = [];
    try {
      chars = save ? listCharacters(save) : [];
    } catch {
      chars = [];
    }
    if (!save || chars.length === 0) {
      console.log("  · skipped");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const pools = computeArkhCoinPools(save, ch.charIndex, BEST_MAP);
        const total = combineCoinPools(pools).total;
        if (Number.isFinite(total) && total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
        bestPools = mergeBest(bestPools, pools);
      } catch {
        // skip a char that fails to compute
      }
    }
    if (!bestTotal || playerBest > bestTotal.total) bestTotal = { player: name, char: playerBestChar, total: playerBest };
    scanned++;
    console.log(`  ✓ best ${playerBest.toExponential(3)}x (${playerBestChar})`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  if (!bestPools || scanned < MIN_PLAYERS) {
    console.error(`× only ${scanned} players scanned (< ${MIN_PLAYERS}); refusing to publish`);
    process.exit(1);
  }

  // Base = every class-specific coin talent zeroed; each profile adds back
  // the talents its classes own. Zeroing keeps the paths, so the page merges
  // {...base, ...override}.
  const gated = deriveGatedCoinTalents();
  const baseFlat = profileFlat(bestPools, gated.map((x) => x.id));
  const classProfile: Record<string, string> = {};
  const overrides: Record<string, Record<string, number>> = {};
  let maxProfileTotal = baseFlat[COIN_ROOT] || 0;
  for (const c of allClassKeys()) {
    const owned = gated.filter((x) => x.owners.has(c)).map((x) => x.id);
    const key = profileKey(owned);
    classProfile[c] = key;
    if (key === "base" || overrides[key]) continue;
    const pf = profileFlat(bestPools, gated.filter((x) => !owned.includes(x.id)).map((x) => x.id));
    const d: Record<string, number> = {};
    for (const k in pf) if (baseFlat[k] !== pf[k]) d[k] = pf[k];
    overrides[key] = d;
    maxProfileTotal = Math.max(maxProfileTotal, pf[COIN_ROOT] || 0);
  }

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · gated talents: ${gated.map((x) => x.id).join(", ") || "none"}`);
  console.log(`  · best per-class ceiling: ${maxProfileTotal.toExponential(3)}x`);
  console.log(`  · best real player: ${bestTotal?.total.toExponential(3)}x by ${bestTotal?.player} (${bestTotal?.char})`);

  emitFiles(baseFlat, overrides, classProfile, bestTotal, maxProfileTotal, scanned);
}

function emitFiles(
  baseFlat: Record<string, number>,
  overrides: Record<string, Record<string, number>>,
  classProfile: Record<string, string>,
  best: Best | null,
  hypotheticalTotal: number,
  scanned: number
) {
  const now = new Date().toISOString();
  writeFileSync(
    META_FILE,
    [
      "// Top-player Coin Multi reference — metadata only (small, statically",
      "// imported). The path table lives in topCoinMulti.ts and is lazy-loaded.",
      "// Both auto-refreshed by scripts/update-top-coin.ts.",
      "",
      `export const TOP_COIN_GENERATED_AT = ${JSON.stringify(now)};`,
      `export const TOP_COIN_PLAYERS_SCANNED = ${scanned};`,
      "// Best Coin Multi a single CLASS's best-of-each-source build reaches.",
      `export const TOP_COIN_HYPOTHETICAL_TOTAL = ${hypotheticalTotal};`,
      "// Highest Coin Multi of a single real player, for context.",
      `export const TOP_COIN_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
      "",
    ].join("\n")
  );
  console.log(`\n✓ Wrote ${META_FILE}`);

  const obj = (m: Record<string, number>) => {
    const lines: string[] = ["{"];
    for (const path of Object.keys(m).sort()) {
      if (!Number.isFinite(m[path])) continue;
      lines.push(`    ${JSON.stringify(path)}: ${m[path]},`);
    }
    lines.push("  }");
    return lines.join("\n");
  };
  const overrideEntries = Object.keys(overrides)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${obj(overrides[k])},`)
    .join("\n");

  writeFileSync(
    OUTPUT_FILE,
    [
      "// Top-player Coin Multi reference — best-of-each-source pools run through",
      "// ONE combine() pass (the same coin math a real save uses), gated PER CLASS",
      "// for the coin formula's class talents. Use topCoinFlatForClass(classKey).",
      "// Large file: lazy-load it, don't import statically.",
      `// Generated ${now} · ${scanned} players. Refresh: scripts/update-top-coin.ts.`,
      "",
      "type FlatMap = Readonly<Record<string, number>>;",
      "",
      `export const TOP_COIN_FLAT: FlatMap = ${obj(baseFlat)};`,
      "",
      "export const TOP_COIN_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {",
      overrideEntries,
      "};",
      "",
      `export const TOP_COIN_CLASS_PROFILE: Readonly<Record<string, string>> = ${JSON.stringify(classProfile, null, 2)};`,
      "",
      "/** The top Coin Multi reference for a class — base merged with its profile. */",
      "export function topCoinFlatForClass(classKey: string | null | undefined): FlatMap {",
      "  const profile = classKey ? TOP_COIN_CLASS_PROFILE[classKey] : undefined;",
      "  const override = profile ? TOP_COIN_PROFILE_OVERRIDES[profile] : undefined;",
      "  return override ? { ...TOP_COIN_FLAT, ...override } : TOP_COIN_FLAT;",
      "}",
      "",
    ].join("\n")
  );
  console.log(`✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
