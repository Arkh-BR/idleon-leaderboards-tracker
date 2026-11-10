// ===== ARKH DAMAGE ENTRY POINT =====
// The Player Info damage (N.js DamageDealed) for one character on one map.
// mapIdx feeds the map rules (sources ratDmg / map306: map 43 replaces Max,
// map 306 divides it); elsewhere Max doesn't depend on the map. See computeStat.ts.

import damageDesc from "./stats/defs/damage";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhDamage(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(damageDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhDamagePools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(damageDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineDamagePools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(damageDesc, pools);
}

export { DMG_COLLECTOR_MAP } from "@/lib/damage/layers";
