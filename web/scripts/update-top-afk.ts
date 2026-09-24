// Refresh the bundled top-player AFK Gains Rate reference in
// lib/afkGains/topAfkGains.ts (+ .meta.ts). Each character is measured on its
// save's best Arcane AFK map (bestAfkMapIdx: the fighting map with the highest
// arcane slot-2 bonus — spec A6); talents 79/88/268/448 are gated per class
// (A10). Neutral values are 0 (they're all in the fighting pool); the map
// rules stay neutral because the chosen map is never 216 or 306.
//
// Run (from web/):  npx tsx scripts/update-top-afk.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhAfkPools, combineAfkPools, bestAfkMapIdx } from "../lib/arkh/computeAfk";
import { AFK_ROOT, AFK_POOLS } from "../lib/arkh/stats/defs/afk-gains";
import { AFK_CLASS_TALENTS } from "../lib/arkh/stats/systems/afk/afk";

runTopCollector({
  label: "AFK Gains Rate",
  focusBoard: "afkTime",
  root: AFK_ROOT,
  groups: AFK_POOLS,
  computePools: (save, ci) => computeArkhAfkPools(save, ci, bestAfkMapIdx(save, ci)),
  combine: combineAfkPools,
  gated: deriveGatedTalentsFor(AFK_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "afkGains", "topAfkGains.ts"),
  metaFile: join(__dirname, "..", "lib", "afkGains", "topAfkGains.meta.ts"),
  constPrefix: "TOP_AFK",
  flatForClassFn: "topAfkFlatForClass",
  scriptName: "scripts/update-top-afk.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
