// ===== GRIMOIRE DATA =====
import { GrimoireUpg } from "@/lib/game/data/generated/customlists.js";

export function grimoireUpgPerLevel(idx: number): number {
  return Number((GrimoireUpg as any)[idx]?.[5]) || 0;
}
