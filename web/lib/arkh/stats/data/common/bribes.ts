// ===== BRIBE DATA =====
// 1:1 port of corgan-source/js/stats/data/common/bribes.js.
import { BribeDescriptions } from "../game/customlists.js";

export function bribeValue(idx: number): number {
  return Number((BribeDescriptions as any)[idx]?.[5]) || 0;
}
