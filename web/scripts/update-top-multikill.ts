// Refresh the bundled top-player Multikill reference in
// lib/multikill/topMultikill.ts (+ .meta.ts). Every character is measured on
// map 251 (w6a1, MK_COLLECTOR_MAP — spec M7): every endgame character is at
// the tier-51 cap there, so MK = B + 51·P doesn't depend on the unreconciled
// max damage, and the Death Note row is the W6 page. Candidates: the #1 of
// every board plus the top 10 of Monsters Killed (M15). Talents 46/469 are
// gated per class (M16); both sit in the per-tier sum, so `groups: []` makes
// their neutral value 0.
//
// Run (from web/):  npx tsx scripts/update-top-multikill.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhMultikillPools, combineMultikillPools, MK_COLLECTOR_MAP } from "../lib/arkh/computeMultikill";
import { MK_ROOT } from "../lib/arkh/stats/defs/multikill";
import { MK_CLASS_TALENTS } from "../lib/arkh/stats/systems/multikill/multikill";

runTopCollector({
  label: "Multikill",
  focusBoard: "monstersKilled",
  root: MK_ROOT,
  groups: [],
  computePools: (save, ci) => computeArkhMultikillPools(save, ci, MK_COLLECTOR_MAP),
  combine: combineMultikillPools,
  gated: deriveGatedTalentsFor(MK_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "multikill", "topMultikill.ts"),
  metaFile: join(__dirname, "..", "lib", "multikill", "topMultikill.meta.ts"),
  constPrefix: "TOP_MULTIKILL",
  flatForClassFn: "topMultikillFlatForClass",
  scriptName: "scripts/update-top-multikill.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
