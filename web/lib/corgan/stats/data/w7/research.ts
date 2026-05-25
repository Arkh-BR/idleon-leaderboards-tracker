// ===== W7 RESEARCH DATA =====
// Minimal slice — only the constants Stage 4 systems read.
import { Research } from "../game/customlists.js";

const _research = Research as any[];

// RES_GRID_RAW[id] = [name, ?, perLvBonus]
export const RES_GRID_RAW: any[][] = (_research[8] as any[]) || [];

export const SHAPE_BONUS_PCT: number[] = _research[5].map(Number);
export const SHAPE_NAMES: string[] = (_research[4] as any[]).map((s: string) =>
  String(s).replace(/_/g, " ")
);

export function gridBonusPerLv(id: number): number {
  return RES_GRID_RAW[id] ? Number(RES_GRID_RAW[id][2]) || 0 : 0;
}
