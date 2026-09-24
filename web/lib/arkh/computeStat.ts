// ===== GENERIC STAT ENTRY POINT =====
// Loads the save into the arkh state singleton and runs a grouped stat
// descriptor (Coin Multi, EXP Multi, …) for one character on one map.
// mapIdx is the selected map; afkTarget is the character's saved
// AFKtarget_N (Coin's talent 643 reads it).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import * as data from "./save/data";
import { buildTree, buildPools, type Descriptor, type Pool } from "./stats/tree-builder";
import { getCatalog, type SystemCtx } from "./stats/registry";
import type { ArkhNode } from "./node";

export type StatResult = { tree: ArkhNode; total: number };

export function statCtx(rawEnvelope: any, charIdx: number, mapIdx: number): SystemCtx {
  const afkTargetRaw = rawEnvelope?.data?.["AFKtarget_" + charIdx];
  const afkTarget = afkTargetRaw != null && afkTargetRaw !== "" ? String(afkTargetRaw) : undefined;
  return { saveData, charIdx, activeCharIdx: charIdx, mapBon: data.mapBonData, mapIdx, afkTarget };
}

export function computeStatTree(desc: Descriptor, rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  loadSaveData(rawEnvelope);
  const tree = buildTree(desc, getCatalog(), statCtx(rawEnvelope, charIdx, mapIdx));
  return { tree, total: tree.val };
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeStatPools(
  desc: Descriptor,
  rawEnvelope: any,
  charIdx: number,
  mapIdx: number = 0
): Record<string, Pool> {
  loadSaveData(rawEnvelope);
  return buildPools(desc, getCatalog(), statCtx(rawEnvelope, charIdx, mapIdx));
}

export function combineStatPools(desc: Descriptor, pools: Record<string, Pool>): StatResult {
  const r = desc.combine(pools, {} as never);
  return {
    tree: { name: desc.name, val: r.val, fmt: r.fmt ?? "x", children: r.children, ...(r.note ? { note: r.note } : {}) },
    total: r.val,
  };
}
