// ===== W7 RESEARCH DATA =====
// 1:1 port of corgan-source/js/stats/data/w7/research.js (DR slice).
//
// Grid bonus-per-level table is built from ResGridSquares, NOT Research[8].
// (Research[8] holds lens descriptions; the old port read from there and the
// fallback `|| 25` masked the bug — bonusPerLv was always 25 for every grid
// node, which inflated glimbo (grid 168) and grid 173 massively.)

import { Research, ResGridSquares } from "../game/customlists.js";

const _research = Research as any[];
const _resGrid = ResGridSquares as any[][];

// ResGridSquares entries: [name, maxLV, bonusPerLV, ?, ?, description]
// Skip placeholder entries (name === "Name").
export const RES_GRID_RAW: Record<number, [string, number, number, string]> = {};
_resGrid.forEach((entry, idx) => {
  if (entry[0] !== "Name") {
    RES_GRID_RAW[idx] = [
      String(entry[0]),
      Number(entry[1]) || 0,
      Number(entry[2]) || 0,
      String(entry[5] || ""),
    ];
  }
});

export const SHAPE_BONUS_PCT: number[] = _research[5].map(Number);
export const SHAPE_NAMES: string[] = (_research[4] as any[]).map((s: string) =>
  String(s).replace(/_/g, " ")
);

export function gridBonusPerLv(id: number): number {
  return RES_GRID_RAW[id] ? RES_GRID_RAW[id][2] : 0;
}
