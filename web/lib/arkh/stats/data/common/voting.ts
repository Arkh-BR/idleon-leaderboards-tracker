// ===== VOTING DATA =====
import { NinjaInfo } from "../game/customlists.js";

export function votingBonusValue(idx: number): number {
  return Number((NinjaInfo as any)[38]?.[idx * 3 + 1]) || 0;
}
