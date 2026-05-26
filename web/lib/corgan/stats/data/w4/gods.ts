// ===== GODS DATA =====
// 1:1 port of corgan-source/js/stats/data/w4/gods.js.
import { GodsInfo } from "../game/customlists.js";

const _gods = GodsInfo as any[];

export function godsType(idx: number): number {
  return _gods[idx] != null ? Number(_gods[idx][13]) || 0 : -1;
}
