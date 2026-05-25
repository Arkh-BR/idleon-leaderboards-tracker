// ===== EMPEROR DATA =====
// 1:1 port of corgan-source/js/stats/data/common/emperor.js.
import { EmperorBon } from "../game/customlists.js";
import { EquipmentSets } from "../game/custommaps.js";

export function emperorBonVal(idx: number): number {
  return Number((EmperorBon as any)[1]?.[idx]) || 0;
}
export function emperorBonType(idx: number): number {
  return Number((EmperorBon as any)[2]?.[idx]) || 0;
}
export const EMPEROR_SET_BONUS_VAL = Number(
  (EquipmentSets as any).EMPEROR_SET[3][2]
);
