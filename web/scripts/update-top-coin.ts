// Refresh the bundled top-player Coin Multi reference in
// lib/coinMulti/topCoinMulti.ts (+ .meta.ts), on lib/game: the page's tracker
// (computeGameCoinMulti) read into pools, combined with the page's own gains
// model. Every char is measured at map
// 301 (world 7, for the guild term); the formula's class talents
// (COIN_CLASS_TALENTS — Coins For Charon among them) are gated per class.
// Only the Cash Bubbles (CashSTR/AGI/WIS × ⌊stat/250⌋) are stat-scaled, so
// only that group stays per class family; every other source takes the best
// across all families.
//
// Run (from web/):  npx tsx scripts/update-top-coin.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type StatCollectorConfig } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { groupedCombine, groupParents, poolsOf } from "./_shared/gamePools";
import { computeGameCoinMulti } from "../lib/game/trackers/coinMulti";
import { COIN_CLASS_TALENTS, COIN_GROUPS, COIN_ROOT } from "../lib/coinMulti/layers";
import { COIN_PAGE } from "../lib/coinMulti/pageConfig";

const PARENTS = groupParents(COIN_ROOT, COIN_GROUPS);

export const COIN_COLLECTOR: StatCollectorConfig = {
  label: "Coin Multi",
  focusBoard: "cashMulti",
  root: COIN_ROOT,
  groups: COIN_GROUPS,
  // The map feeds the guild world (⌊map/50⌋ + 1) and talent 643's multikill
  // tier. 301 (w7a1) is W7's first fighting map; 300 is a town (tier 1).
  computePools: (save, ci) => poolsOf(computeGameCoinMulti(save, ci, 301).tree, PARENTS),
  combine: groupedCombine(COIN_ROOT, COIN_GROUPS, COIN_PAGE.gains),
  gated: deriveGatedTalentsFor(COIN_CLASS_TALENTS),
  familySources: [{ group: "g01" }], // 🫧 Cash Bubbles
  outputFile: join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.ts"),
  metaFile: join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.meta.ts"),
  constPrefix: "TOP_COIN",
  flatForClassFn: "topCoinFlatForClass",
  scriptName: "scripts/update-top-coin.ts",
};

// Imported by the round-trip test and compare-top-ref without running the collector.
if (require.main === module) runTopCollector(COIN_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
