// ===== ARKH COIN MULTI ENTRY POINT =====
// mapIdx feeds the guild term (×(1 + ⌊map/50⌋)) and talent 643's multikill
// tier (OverkillStuffs, rescaled to the selected map). See computeStat.ts.

import coinMultiDesc from "./stats/defs/coin-multi";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export type ArkhCoinResult = StatResult;

export function computeArkhCoinMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): ArkhCoinResult {
  return computeStatTree(coinMultiDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhCoinPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(coinMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineCoinPools(pools: Record<string, Pool>): ArkhCoinResult {
  return combineStatPools(coinMultiDesc, pools);
}
