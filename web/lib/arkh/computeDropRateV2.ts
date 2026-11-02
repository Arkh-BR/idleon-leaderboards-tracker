// ===== ARKH DROP RATE V2 ENTRY POINT =====
// N.js TotalStats("Drop_Rarity") for one character on one map: the map feeds
// the Arcane slot-0 bonus and the Cove line (map 216). See computeStat.ts.

import dropRateV2Desc from "./stats/defs/drop-rate-v2";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhDropRateV2(raw: any, ci: number, map: number): StatResult {
  return computeStatTree(dropRateV2Desc, raw, ci, map);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhDropRateV2Pools(raw: any, ci: number, map: number): Record<string, Pool> {
  return computeStatPools(dropRateV2Desc, raw, ci, map);
}

export function combineDropRateV2Pools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(dropRateV2Desc, pools);
}
