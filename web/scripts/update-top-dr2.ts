// Refresh the bundled top-player Drop Rate V2 reference in
// lib/dropRateV2/topDropRateV2.ts (+ .meta.ts), on lib/game: the page's tracker
// (computeGameDropRate) read into pools, combined with the page's own gains
// model. Drop Rate V2 is N.js TotalStats("Drop_Rarity") term by term. Each
// character is measured on its save's best Arcane drop map (MAP_PICKS.dr2: the
// fighting map with the highest arcane slot-0 bonus — never the Cove, 216);
// the formula's class talents (DR2_CLASS_TALENTS) are gated per class. Only
// the LUK curve is stat-scaled
// (LUK is the beginner line's main stat), so only it stays per CLASS FAMILY;
// every other source takes the best across all families. Equipment is taken
// cross-family too, so a Class ALL item like the Corsair Uniform counts for a
// family none of whose top players wears it. A few weapons are class-locked:
// Mittens of the Gods (beginner only, +40% Drop Rate vs +20 for the other
// lines' best weapons) sets the Drop Rate (Equipment) row for every family —
// ~0.02% of the root, accepted.
//
// Run (from web/):  npx tsx scripts/update-top-dr2.ts   [--limit N] [--slow] [--saves-dir <dir>]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type StatCollectorConfig } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { groupedCombine, groupParents, MAP_PICKS, pickMap, poolsOf } from "./_shared/gamePools";
import { computeGameDropRate } from "../lib/game/trackers/dropRate";
import { DR2_CLASS_TALENTS, DR2_GROUPS, DR2_ROOT } from "../lib/dropRateV2/layers";
import { DR2_PAGE } from "../lib/dropRateV2/pageConfig";

const PARENTS = groupParents(DR2_ROOT, DR2_GROUPS);

export const DR2_COLLECTOR: StatCollectorConfig = {
  label: "Drop Rate V2",
  focusBoard: "dropRate",
  root: DR2_ROOT,
  groups: DR2_GROUPS,
  computePools: (save, ci) => poolsOf(computeGameDropRate(save, ci, pickMap(save, ci, MAP_PICKS.dr2)).tree, PARENTS),
  combine: groupedCombine(DR2_ROOT, DR2_GROUPS, DR2_PAGE.gains),
  gated: deriveGatedTalentsFor(DR2_CLASS_TALENTS),
  familySources: [{ group: "base", name: "LUK Scaling (Drop Rate)" }],
  outputFile: join(__dirname, "..", "lib", "dropRateV2", "topDropRateV2.ts"),
  metaFile: join(__dirname, "..", "lib", "dropRateV2", "topDropRateV2.meta.ts"),
  constPrefix: "TOP_DR2",
  flatForClassFn: "topDr2FlatForClass",
  scriptName: "scripts/update-top-dr2.ts",
};

// Imported by the round-trip test and compare-top-ref without running the collector.
if (require.main === module) runTopCollector(DR2_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
