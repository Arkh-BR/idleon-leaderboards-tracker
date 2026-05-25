// ===== PRAYER DATA =====
import { PrayerInfo } from "../game/customlists.js";

export function prayerBaseBonus(idx: number, costIdx?: number): number {
  const col = costIdx === 1 ? 4 : 3;
  return Number((PrayerInfo as any)[idx]?.[col]) || 0;
}
