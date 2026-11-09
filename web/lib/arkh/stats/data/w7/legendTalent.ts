// ===== LEGEND TALENT DATA =====
import { LegendTalents } from "@/lib/game/data/generated/customlists.js";

export function legendTalentPerPt(idx: number): number {
  return Number((LegendTalents as any)[idx]?.[2]) || 0;
}
