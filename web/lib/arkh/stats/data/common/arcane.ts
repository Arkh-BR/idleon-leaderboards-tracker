// ===== ARCANE DATA =====
import { ArcaneUpg } from "@/lib/game/data/generated/customlists.js";

export function arcanePerLevel(idx: number): number {
  return Number((ArcaneUpg as any)[idx]?.[5]) || 0;
}
