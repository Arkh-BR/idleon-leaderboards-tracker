// ===== MINEHEAD DATA =====
// 1:1 port of corgan-source/js/stats/data/w7/minehead.js (DR-relevant slice).
import { MineheadUPG as _RAW_UPG, Research } from "../game/customlists.js";

const _research = Research as any[];
const _rawUpg = _RAW_UPG as any[];

export const MINEHEAD_BONUS_QTY: number[] = _research[20].map(Number);

export const MINEHEAD_UPG = _rawUpg.map((u: any) => ({
  name: u[0] as string,
  maxLv: Number(u[1]),
  costExp: Number(u[2]),
  bonus: Number(u[3]),
  desc: String(u[5]).replace(/_/g, " ").split("@")[0].trim(),
}));

export const GRID_DIMS: any[] = (_research[9] as any[]).slice();

export const TILE_MULTIPLIERS: readonly number[] = [
  1.2, 1.4, 1.6, 2.0, 3, 4, 5, 6, 7, 8, 1, 1, 1, 1,
] as const;

export const MINEHEAD_UNLOCK_ORDER: number[] = _research[10].map(Number);
