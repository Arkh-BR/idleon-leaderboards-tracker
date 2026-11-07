// ===== EXP MULTI DESCRIPTOR =====
// N.js x._customBlock_ExpMulti(0) (@4238487–@4247524): the character's Class
// EXP multiplier, the "Class EXP:" line of the stats panel. Every term is a
// source of the `exp` system (systems/exp/exp.ts); the group shapes live here.
//   EXP = Workbench × (1 + LUK3/100) × LUK5 × (1 + Etc78/100)
//         × (1 + LUKcurve·(1 + T35/100)/1.8 + Σ/100)
// LUK5 is split into G3–G8. G10 carries the LUK curve as two % sources
// (luk + talent35) so class gating can zero Lucky Charms alone.

import { groupedDescriptor } from "./grouped";

// The display config (root, vote node, groups) lives in lib/expMulti/layers (Ruling B): re-exported, so every importer of this def keeps working.
import { EXP_GROUPS, EXP_ROOT } from "@/lib/expMulti/layers";
export { EXP_GROUPS, EXP_ROOT, EXP_VOTE_NAME } from "@/lib/expMulti/layers";

const expMultiDesc = groupedDescriptor({
  id: "exp-multi",
  name: EXP_ROOT,
  scope: "character+map",
  category: "progression",
  system: "exp",
  groups: EXP_GROUPS,
});

export default expMultiDesc;
