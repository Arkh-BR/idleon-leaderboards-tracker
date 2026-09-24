// ===== ARKH AFK GAINS ENTRY POINT =====
// mapIdx drives the map terms: arcane slot 2, Clamworks' ×0.2 (306), the
// Crystal Glunko Cove (216 + cavern 17) and whether the map's default AFK
// target is a fight (spec A9). See computeStat.ts.

import afkGainsDesc from "./stats/defs/afk-gains";
import { computeStatTree, computeStatPools, combineStatPools, statCtx, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";
import { loadSaveData } from "./save/loader";
import { currentMapData } from "./save/data";
import { MapAFKtarget } from "./stats/data/game/customlists.js";
import { MONSTERS } from "./stats/data/game/monsters.js";
import { computeArcaneMapMultiBon } from "./stats/systems/mc/tesseract";

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

/** Spec A6: the fighting map (default target FIGHTING; never 216 or 306)
 *  with the highest arcane slot-2 bonus — among fighting maps it's the only
 *  term that moves (the shrine is treated as global). Ties → the lowest
 *  index. No slot-2 kills anywhere → the character's own map when it's a
 *  candidate, else 301 (W7's first fighting map, Coin's BEST_MAP). The
 *  Observed Max collector measures every character here. */
export function bestAfkMapIdx(rawEnvelope: any, charIdx: number): number {
  loadSaveData(rawEnvelope);
  const ctx = statCtx(rawEnvelope, charIdx, 0);
  const targets = MapAFKtarget as unknown as string[];
  const isFight = (m: number) =>
    m !== 216 && m !== 306 && (MONSTERS as any)[targets[m]]?.AFKtype === "FIGHTING";
  let best = -1;
  let bestScore = 0;
  for (let m = 0; m < targets.length; m++) {
    if (!isFight(m)) continue;
    const score = computeArcaneMapMultiBon(2, { ...ctx, mapIdx: m } as any);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best >= 0) return best;
  const own = Number((currentMapData as any)?.[charIdx]) || 0;
  return isFight(own) ? own : 301;
}
