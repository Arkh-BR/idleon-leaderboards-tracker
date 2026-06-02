// ===== CARD DATA =====
// 1:1 port of corgan-source/js/stats/data/common/cards.js.
import { CardStuff } from "../game/customlists.js";

export const CARD_BASE_REQ: Record<string, number> = {};
export const CARD_BONUS: Record<string, { desc: string; val: number }> = {};

const _cardStuffArr = CardStuff as any[][][];
for (let _cw = 0; _cw < _cardStuffArr.length; _cw++) {
  const _world = _cardStuffArr[_cw];
  for (let _ci = 0; _ci < _world.length; _ci++) {
    const _c = _world[_ci];
    const _id = _c[0] as string;
    const _req = Number(_c[2]);
    const _desc = _c[3] as string;
    const _val = Number(_c[4]);
    if (_req !== 10) CARD_BASE_REQ[_id] = _req;
    CARD_BONUS[_id] = { desc: _desc, val: _val };
  }
}

export function cardBaseReq(id: string): number {
  return CARD_BASE_REQ[id] || 10;
}
export function cardBonusVal(id: string): number {
  const b = CARD_BONUS[id];
  return b ? b.val : 0;
}
export function cardBonusDesc(id: string): string {
  const b = CARD_BONUS[id];
  return b ? b.desc : "";
}

export const CARD_DR_BONUS: Record<string, number> = {};
export const CARD_DR_PASSIVE: Record<string, number> = {};
export const CARD_DR_MULTI: Record<string, number> = {};
for (const _kid in CARD_BONUS) {
  const _kb = CARD_BONUS[_kid];
  if (_kb.desc === "+{%_Total_Drop_Rate") CARD_DR_BONUS[_kid] = _kb.val;
  else if (_kb.desc === "+{%_Total_Drop_Rate_(Passive)")
    CARD_DR_PASSIVE[_kid] = _kb.val;
  else if (_kb.desc === "+{%_Drop_Rate_Multi") CARD_DR_MULTI[_kid] = _kb.val;
}
