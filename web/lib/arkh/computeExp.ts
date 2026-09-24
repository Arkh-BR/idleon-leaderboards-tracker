// ===== ARKH EXP MULTI ENTRY POINT =====
// mapIdx drives the two map terms: the arcane map bonus (slot 1) and whether
// the Shiny Medallions talent applies (the map's default monster's medallion).

import expMultiDesc from "./stats/defs/exp-multi";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhExpMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(expMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function computeArkhExpPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(expMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineExpPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(expMultiDesc, pools);
}
