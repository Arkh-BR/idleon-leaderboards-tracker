// ===== ARCANE DATA =====
import { ArcaneUpg } from "../game/customlists.js";

export function arcanePerLevel(idx: number): number {
  return Number((ArcaneUpg as any)[idx]?.[5]) || 0;
}
