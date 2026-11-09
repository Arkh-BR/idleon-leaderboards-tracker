// ===== VOTING DATA =====
import { NinjaInfo } from "@/lib/game/data/generated/customlists.js";

export function votingBonusValue(idx: number): number {
  return Number((NinjaInfo as any)[38]?.[idx * 3 + 1]) || 0;
}

/** NinjaInfo[38][2 + 3·idx]: the world a vote asks for. */
export function votingWorldReq(idx: number): number {
  return Number((NinjaInfo as any)[38]?.[idx * 3 + 2]) || 0;
}
