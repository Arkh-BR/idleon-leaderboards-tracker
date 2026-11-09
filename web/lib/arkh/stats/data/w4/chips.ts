// ===== CHIP DATA =====
import { ChipDesc } from "@/lib/game/data/generated/customlists.js";

export function chipBonusValue(idx: number): number {
  return Number((ChipDesc as any)[idx]?.[11]) || 0;
}
