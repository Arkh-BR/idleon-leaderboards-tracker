// ===== CHIP DATA =====
import { ChipDesc } from "../game/customlists.js";

export function chipBonusValue(idx: number): number {
  return Number((ChipDesc as any)[idx]?.[11]) || 0;
}
