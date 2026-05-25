// ===== LEGEND TALENT DATA =====
import { LegendTalents } from "../game/customlists.js";

export function legendTalentPerPt(idx: number): number {
  return Number((LegendTalents as any)[idx]?.[2]) || 0;
}
