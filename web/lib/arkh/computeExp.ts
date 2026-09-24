// ===== ARKH EXP MULTI ENTRY POINT =====
// mapIdx drives the two map terms: the arcane map bonus (slot 1) and whether
// the Shiny Medallions talent applies (the map's default monster's medallion).

import expMultiDesc from "./stats/defs/exp-multi";
import { computeStatTree, computeStatPools, combineStatPools, statCtx, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";
import { loadSaveData } from "./save/loader";
import { MapAFKtarget } from "./stats/data/game/customlists.js";
import { computeArcaneMapMultiBon } from "./stats/systems/mc/tesseract";
import { talent } from "./stats/systems/common/talent";
import { medallionList } from "./stats/systems/exp/medallions";
import { saveData } from "./state";

export function computeArkhExpMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(expMultiDesc, rawEnvelope, charIdx, mapIdx);
}

/** Spec D5: the map that maximises the two map terms — arcane slot 1 ×
 *  Shiny Medallions (owned medallion of the map's default monster). Ties →
 *  the lowest index. The Observed Max collector measures each char here. */
export function bestExpMapIdx(rawEnvelope: any, charIdx: number): number {
  loadSaveData(rawEnvelope);
  const s: any = saveData;
  const ctx = statCtx(rawEnvelope, charIdx, 0);
  const t429 = Math.max(1, Number(talent.resolve(429, { saveData: s, charIdx, activeCharIdx: charIdx } as any).val) || 0);
  const medals = medallionList(s);
  let best = 0;
  let bestScore = -Infinity;
  const targets = MapAFKtarget as unknown as string[];
  for (let m = 0; m < targets.length; m++) {
    const arcane = computeArcaneMapMultiBon(1, { ...ctx, mapIdx: m } as any);
    const score = (1 + arcane / 100) * (medals.includes(String(targets[m])) ? t429 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function computeArkhExpPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(expMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineExpPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(expMultiDesc, pools);
}
