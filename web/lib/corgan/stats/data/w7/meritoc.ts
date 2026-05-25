// ===== MERITOC DATA =====
import { NinjaInfo } from "../game/customlists.js";

export const MERITOC_BASE: number[] = [];
const _ni41 = (NinjaInfo as any)[41] as any[];
for (let i = 1; i < _ni41.length; i += 3) {
  MERITOC_BASE.push(Number(_ni41[i]));
}
