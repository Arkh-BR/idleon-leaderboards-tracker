// Refresh the bundled top-player EXP Multi reference in
// lib/expMulti/topExpMulti.ts (+ .meta.ts), on lib/game: the page's tracker
// (computeGameExpMulti) read into pools, combined with the page's own gains
// model. Each character is measured on its save's best EXP map
// (MAP_PICKS.exp: arcane slot 1 × Shiny Medallions — the spec's D5); Lucky Charms (talent 35) is gated per class. The LUK curve (its
// "LUK Scaling" term and Lucky Charms' ×curve cross term) is the only
// stat-scaled source, so only those stay per class family; every other source
// takes the best across all families.
//
// Run (from web/):  npx tsx scripts/update-top-exp.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type StatCollectorConfig } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { groupedCombine, groupParents, MAP_PICKS, pickMap, poolsOf } from "./_shared/gamePools";
import { computeGameExpMulti } from "../lib/game/trackers/expMulti";
import { EXP_CLASS_TALENTS, EXP_GROUPS, EXP_ROOT } from "../lib/expMulti/layers";
import { EXP_PAGE } from "../lib/expMulti/pageConfig";

const PARENTS = groupParents(EXP_ROOT, EXP_GROUPS);

export const EXP_COLLECTOR: StatCollectorConfig = {
  label: "EXP Multi",
  focusBoard: "totalLevels",
  root: EXP_ROOT,
  groups: EXP_GROUPS,
  computePools: (save, ci) => poolsOf(computeGameExpMulti(save, ci, pickMap(save, ci, MAP_PICKS.exp)).tree, PARENTS),
  combine: groupedCombine(EXP_ROOT, EXP_GROUPS, EXP_PAGE.gains),
  gated: deriveGatedTalentsFor(EXP_CLASS_TALENTS),
  familySources: [
    { group: "g10", name: "LUK Scaling (Class EXP)" },
    { group: "g10", name: "Lucky Charms (Talent 35)" },
  ],
  outputFile: join(__dirname, "..", "lib", "expMulti", "topExpMulti.ts"),
  metaFile: join(__dirname, "..", "lib", "expMulti", "topExpMulti.meta.ts"),
  constPrefix: "TOP_EXP",
  flatForClassFn: "topExpFlatForClass",
  scriptName: "scripts/update-top-exp.ts",
};

// Imported by the round-trip test and compare-top-ref without running the collector.
if (require.main === module) runTopCollector(EXP_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
