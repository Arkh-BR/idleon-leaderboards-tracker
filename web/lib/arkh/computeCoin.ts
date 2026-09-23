// ===== ARKH COIN MULTI ENTRY POINT =====
// Loads the save into the arkh state singleton and runs the coin-multi
// descriptor. mapIdx feeds the guild term (×(1 + ⌊map/50⌋)) and talent 643's
// multikill tier (OverkillStuffs, rescaled to the selected map).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import * as data from "./save/data";
import { buildTree, buildPools, type Pool } from "./stats/tree-builder";
import { getCatalog } from "./stats/registry";
import coinMultiDesc, { COIN_ROOT } from "./stats/defs/coin-multi";
import type { ArkhNode } from "./node";

export type ArkhCoinResult = { tree: ArkhNode; total: number };

function ctxFor(rawEnvelope: any, charIdx: number, mapIdx: number) {
  const afkTargetRaw = rawEnvelope?.data?.["AFKtarget_" + charIdx];
  const afkTarget = afkTargetRaw != null && afkTargetRaw !== "" ? String(afkTargetRaw) : undefined;
  return { saveData, charIdx, activeCharIdx: charIdx, mapBon: data.mapBonData, mapIdx, afkTarget };
}

export function computeArkhCoinMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): ArkhCoinResult {
  loadSaveData(rawEnvelope);
  const tree = buildTree(coinMultiDesc, getCatalog(), ctxFor(rawEnvelope, charIdx, mapIdx));
  return { tree, total: tree.val };
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhCoinPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  loadSaveData(rawEnvelope);
  return buildPools(coinMultiDesc, getCatalog(), ctxFor(rawEnvelope, charIdx, mapIdx));
}

export function combineCoinPools(pools: Record<string, Pool>): ArkhCoinResult {
  const r = coinMultiDesc.combine(pools, {} as never);
  return { tree: { name: COIN_ROOT, val: r.val, fmt: "x", children: r.children }, total: r.val };
}
