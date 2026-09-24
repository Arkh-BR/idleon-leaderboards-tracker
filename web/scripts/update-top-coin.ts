// Refresh the bundled top-player Coin Multi reference in
// lib/coinMulti/topCoinMulti.ts (+ .meta.ts). Every char is measured at map
// 301 (world 7, for the guild term); the formula's class talents
// (COIN_CLASS_TALENTS — Coins For Charon among them) are gated per class.
//
// Run (from web/):  npx tsx scripts/update-top-coin.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhCoinPools, combineCoinPools } from "../lib/arkh/computeCoin";
import { COIN_ROOT, COIN_GROUPS } from "../lib/arkh/stats/defs/coin-multi";
import { COIN_CLASS_TALENTS } from "../lib/arkh/stats/systems/coin/coin";

runTopCollector({
  label: "Coin Multi",
  focusBoard: "cashMulti",
  root: COIN_ROOT,
  groups: COIN_GROUPS,
  // The map feeds the guild world (⌊map/50⌋ + 1) and talent 643's multikill
  // tier. 301 (w7a1) is W7's first fighting map; 300 is a town (tier 1).
  computePools: (save, ci) => computeArkhCoinPools(save, ci, 301),
  combine: combineCoinPools,
  gated: deriveGatedTalentsFor(COIN_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.ts"),
  metaFile: join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.meta.ts"),
  constPrefix: "TOP_COIN",
  flatForClassFn: "topCoinFlatForClass",
  scriptName: "scripts/update-top-coin.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
