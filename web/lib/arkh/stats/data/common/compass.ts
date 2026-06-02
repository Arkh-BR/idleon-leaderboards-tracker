// ===== COMPASS DATA =====
// 1:1 port of corgan-source/js/stats/data/common/compass.js.
import { CompassUpg } from "../game/customlists.js";

const _CompassUpg = CompassUpg as any[];

export function compassUpgPerLevel(idx: number): number {
  return Number(_CompassUpg[idx]?.[5]) || 0;
}
