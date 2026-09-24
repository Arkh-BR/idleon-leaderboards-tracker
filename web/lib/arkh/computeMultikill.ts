// ===== ARKH MULTIKILL ENTRY POINT =====
// mapIdx drives the map terms: the Death Note page (⌊map/50⌋), the W7 soft
// cap and ×5 tier ladder (map ≥ 300), the AFK target (AFKtarget_N on the
// saved map, MapAFKtarget elsewhere — spec M1), Clamworks' HP (306) and the
// Crystal Glunko Cove (216 + cavern 17). See computeStat.ts.

import multikillDesc from "./stats/defs/multikill";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhMultikill(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(multikillDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhMultikillPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(multikillDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineMultikillPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(multikillDesc, pools);
}

/** Spec M7: the Observed Max collector measures every character on map 251
 *  (w6a1). Every endgame character is at the tier-51 cap there, so the
 *  reference doesn't depend on the unreconciled max damage. Moving it to 301
 *  is a follow-up of the max-damage reconciliation. */
export const MK_COLLECTOR_MAP = 251;
