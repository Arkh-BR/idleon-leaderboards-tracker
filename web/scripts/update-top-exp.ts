// Refresh the bundled top-player EXP Multi reference in
// lib/expMulti/topExpMulti.ts (+ .meta.ts). Each character is measured on its
// save's best EXP map (bestExpMapIdx: arcane slot 1 × Shiny Medallions — the
// spec's D5); Lucky Charms (talent 35) is gated per class.
//
// Run (from web/):  npx tsx scripts/update-top-exp.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhExpPools, combineExpPools, bestExpMapIdx } from "../lib/arkh/computeExp";
import { EXP_ROOT, EXP_GROUPS } from "../lib/arkh/stats/defs/exp-multi";
import { EXP_CLASS_TALENTS } from "../lib/arkh/stats/systems/exp/exp";

runTopCollector({
  label: "EXP Multi",
  focusBoard: "totalLevels",
  root: EXP_ROOT,
  groups: EXP_GROUPS,
  computePools: (save, ci) => computeArkhExpPools(save, ci, bestExpMapIdx(save, ci)),
  combine: combineExpPools,
  gated: deriveGatedTalentsFor(EXP_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "expMulti", "topExpMulti.ts"),
  metaFile: join(__dirname, "..", "lib", "expMulti", "topExpMulti.meta.ts"),
  constPrefix: "TOP_EXP",
  flatForClassFn: "topExpFlatForClass",
  scriptName: "scripts/update-top-exp.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
