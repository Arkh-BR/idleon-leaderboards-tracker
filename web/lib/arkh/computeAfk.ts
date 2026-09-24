// ===== ARKH AFK GAINS ENTRY POINT =====
// mapIdx drives the map terms: arcane slot 2, Clamworks' ×0.2 (306), the
// Crystal Glunko Cove (216 + cavern 17) and whether the map's default AFK
// target is a fight (spec A9). See computeStat.ts.

import afkGainsDesc from "./stats/defs/afk-gains";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhAfkGains(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(afkGainsDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhAfkPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(afkGainsDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineAfkPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(afkGainsDesc, pools);
}
