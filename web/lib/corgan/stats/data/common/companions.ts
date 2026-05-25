// ===== COMPANION DATA =====
// 1:1 port of corgan-source/js/stats/data/common/companions.js.
import { CompanionDB } from "../game/customlists.js";

export function companionBonus(idx: number): number {
  return Number((CompanionDB as any)[idx]?.[2]) || 0;
}
