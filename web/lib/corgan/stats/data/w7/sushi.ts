// ===== SUSHI STATION DATA =====
// 1:1 port of corgan-source/js/stats/data/w7/sushi.js.
import { SushiUPG as _RAW_UPG, Research } from "../game/customlists.js";

const _research = Research as any[];
const _rawUpg = _RAW_UPG as any[];

export const ROG_BONUS_QTY: number[] = _research[37].map(Number);

export const SUSHI_UPG: Array<
  [string, number, number, number, number, string]
> = _rawUpg.map((u: any) => [
  String(u[0]).replace(/_/g, " ").replace(/\\'/g, "'"),
  Number(u[1]),
  Number(u[2]),
  Number(u[3]),
  Number(u[4]),
  String(u[5]).replace(/_/g, " ").replace(/\\'/g, "'"),
]);

export const SLOT_TO_UPG: number[] = _research[32].map(Number);
export const TIER_TO_KNOWLEDGE_CAT: number[] = _research[33].map(Number);
export const KNOWLEDGE_CAT_DESC: string[] = _research[34].map((s: string) =>
  s.replace(/_/g, " ")
);
export const KNOWLEDGE_CAT_VALUE: number[] = _research[35].map(Number);
export const ROG_DESC: string[] = _research[36].map((s: string) =>
  s.replace(/_/g, " ")
);

export const CURRENCY_PER_TIER: readonly number[] = [
  1, 3, 8, 20, 50, 115, 250, 560, 1220, 2650,
] as const;

export const MAX_SLOTS = 120;
export const MAX_TIER = 53;
