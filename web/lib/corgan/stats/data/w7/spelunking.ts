// ===== SPELUNKING DATA =====
import { SpelunkUpg } from "../game/customlists.js";

export function spelunkUpgPerLevel(idx: number): number {
  return Number((SpelunkUpg as any)[idx]?.[4]) || 0;
}
