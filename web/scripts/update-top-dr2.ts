// Refresh the bundled top-player Drop Rate V2 reference in
// lib/dropRateV2/topDropRateV2.ts (+ .meta.ts). Drop Rate V2 is N.js
// TotalStats("Drop_Rarity") term by term. Each character is measured on its
// save's best Arcane drop map (bestDrMapIdx: the fighting map with the highest
// arcane slot-0 bonus — never the Cove, 216); the formula's class talents
// (DR2_CLASS_TALENTS) are gated per class. Only the LUK curve is stat-scaled
// (LUK is the beginner line's main stat), so only it stays per CLASS FAMILY;
// every other source takes the best across all families — class-agnostic gear
// like the Corsair Uniform counts for a family none of whose top players wears it.
//
// Run (from web/):  npx tsx scripts/update-top-dr2.ts   [--limit N] [--slow] [--saves-dir <dir>]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhDropRateV2Pools, combineDropRateV2Pools } from "../lib/arkh/computeDropRateV2";
import { bestDrMapIdx } from "../lib/arkh/stats/systems/dr2/maps";
import { DR2_ROOT, DR2_GROUPS } from "../lib/arkh/stats/defs/drop-rate-v2";
import { DR2_CLASS_TALENTS } from "../lib/arkh/stats/systems/dr2/dr2";

runTopCollector({
  label: "Drop Rate V2",
  focusBoard: "dropRate",
  root: DR2_ROOT,
  groups: DR2_GROUPS,
  computePools: (save, ci) => computeArkhDropRateV2Pools(save, ci, bestDrMapIdx(save, ci)),
  combine: combineDropRateV2Pools,
  gated: deriveGatedTalentsFor(DR2_CLASS_TALENTS),
  familySources: [{ group: "base", name: "LUK Scaling (Drop Rate)" }],
  outputFile: join(__dirname, "..", "lib", "dropRateV2", "topDropRateV2.ts"),
  metaFile: join(__dirname, "..", "lib", "dropRateV2", "topDropRateV2.meta.ts"),
  constPrefix: "TOP_DR2",
  flatForClassFn: "topDr2FlatForClass",
  scriptName: "scripts/update-top-dr2.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
