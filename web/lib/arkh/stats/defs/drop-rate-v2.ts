// ===== DROP RATE V2 DESCRIPTOR =====
// N.js _customBlock_TotalStats("Drop_Rarity") (@4188223, live sha 4a6cb9a0c645),
// outside a dungeon, term by term in game order. Every term is a source of the
// `dr2` system (systems/dr2/dr2.ts); the shapes and the order live here:
//   base  = 1 + 1.4·DropRateLUK + Σ/100 (Σ holds DropRateLUK2 term by term;
//           the LUK source is 140·DropRateLUK so it lands outside the /100)
//   chip  : under 5, min(5, total + chipBonuses("dr")/100)
//   +2 bun_v · × Workbench · +0.3 if OLA[232] ≥ 1 · ×1.2 bun_p
//   × every post-processing factor (one group each)
//   Cove  : on map 216 in cavern 17 Holes2("Cglunko_DR") replaces the total.
// The V1 descriptor (defs/drop-rate.ts) is a separate port and stays as is.

import type { Descriptor } from "../tree-builder";
import { groupedDescriptor } from "./grouped";

// The display config (root, vote node, groups) lives in lib/dropRateV2/layers (Ruling B): re-exported, so every importer of this def keeps working.
import { DR2_GROUPS, DR2_ROOT } from "@/lib/dropRateV2/layers";
export { DR2_GROUPS, DR2_ROOT, DR2_VOTE_NAME } from "@/lib/dropRateV2/layers";

const dropRateV2Desc: Descriptor = groupedDescriptor({
  id: "drop-rate-v2",
  name: DR2_ROOT,
  scope: "character+map",
  category: "combat",
  system: "dr2",
  groups: DR2_GROUPS,
});

export default dropRateV2Desc;
