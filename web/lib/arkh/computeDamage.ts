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

/** The Observed Max collector measures every character on map 251 (w6a1) — the
 *  same map as the Multikill collector. Max doesn't depend on the map except on
 *  43 (Royal Guardian arena) and 306 (Clamworks), so any other map leaves both
 *  map rules neutral: the reference is the map-independent Max. */
export const DMG_COLLECTOR_MAP = 251;
