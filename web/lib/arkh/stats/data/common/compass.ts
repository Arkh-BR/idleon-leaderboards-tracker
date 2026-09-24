// ===== COMPASS DATA =====
// 1:1 port of corgan-source/js/stats/data/common/compass.js.
import { CompassUpg } from "../game/customlists.js";

const _CompassUpg = CompassUpg as any[];

export function compassUpgPerLevel(idx: number): number {
  return Number(_CompassUpg[idx]?.[5]) || 0;
}

// N.js CompassBonus branch: `1==CompassUpg[b][9]` gates the "circle" boost
// (Compass 39 + Compass 80 added to the multiplier). Static per-id game data.
export function compassUpgIsCircle(idx: number): boolean {
  return Number(_CompassUpg[idx]?.[9]) === 1;
}
