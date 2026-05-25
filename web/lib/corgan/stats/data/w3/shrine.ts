// ===== SHRINE DATA =====
import { ShrineInfo } from "../game/customlists.js";

export function shrineBase(idx: number): number {
  return Number((ShrineInfo as any)[idx]?.[2]) || 0;
}
export function shrinePerLevel(idx: number): number {
  return Number((ShrineInfo as any)[idx]?.[3]) || 0;
}
