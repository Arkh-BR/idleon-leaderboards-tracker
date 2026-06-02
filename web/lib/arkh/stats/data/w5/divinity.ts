// ===== W5 DIVINITY DATA =====
// 1:1 port of corgan-source/js/stats/data/w5/divinity.js.
import { GodsInfo } from "../game/customlists.js";

const _gods = GodsInfo as any[];

// GodsInfo[godIdx][3] = x1 parameter for minor linked bonus
export function godMinorX1(godIdx: number): number {
  return Number(_gods[godIdx]?.[3]) || 0;
}
