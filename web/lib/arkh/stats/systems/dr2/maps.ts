// ===== DROP RATE V2: REFERENCE MAP =====
// The Drop Rate reads one map term, ArcaneType("ArcaneMapMulti_bon", 0) (slot 0
// of MapBon; the EXP tracker uses slot 1, AFK slot 2), so the best reference
// map is the one with the highest slot-0 arcane bonus. Same shape as
// bestAfkMapIdx / bestExpMapIdx, but built from the stat pages' map list and
// without computeStat (the V2 def imports this file).

import { buildStatMapOptions } from "../../../../statTracker/mapOptions";
import { loadSaveData } from "../../../save/loader";
import { currentMapData, mapBonData } from "../../../save/data";
import { saveData } from "../../../state";
import { isFightingMap } from "../../data/common/maps";
import { computeArcaneMapMultiBon } from "../mc/tesseract";

/** The fighting map (never the Cove, 216) with the highest arcane slot-0 bonus
 *  for character `ci`. Ties → the lowest index. No slot-0 kills anywhere → the
 *  character's own map when it's a candidate, else the lowest candidate.
 *  Candidates are the maps the stat pages offer (buildStatMapOptions). */
export function bestDrMapIdx(save: unknown, ci: number): number {
  loadSaveData(save as any);
  const maps = buildStatMapOptions(save)
    .map((o) => o.index)
    .filter((m) => m !== 216 && isFightingMap(m));
  const ctx = { saveData, charIdx: ci, activeCharIdx: ci, mapBon: mapBonData };
  let best = -1;
  let bestScore = 0;
  for (const m of maps) {
    const score = computeArcaneMapMultiBon(0, { ...ctx, mapIdx: m } as any);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best >= 0) return best;
  const own = Number((currentMapData as any)?.[ci]) || 0;
  return maps.includes(own) ? own : maps[0];
}
