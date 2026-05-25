// ===== MINEHEAD SYSTEM (W7) — DR-relevant slice =====
// 1:1 port of mineheadBonusQTY + minehead.resolve from corgan-source.
// The huge body of the original (grid sim, depth-charge formulas, currency
// per hour, etc.) is out of scope for DR.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { MINEHEAD_BONUS_QTY } from "../../data/w7/minehead";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function mineheadBonusQTY(t: number, mineFloor: number): number {
  return mineFloor > t ? MINEHEAD_BONUS_QTY[t] || 0 : 0;
}

export function buildMhqArray(mineFloor: number): number[] {
  const arr = new Array(MINEHEAD_BONUS_QTY.length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = mineFloor > i ? MINEHEAD_BONUS_QTY[i] || 0 : 0;
  }
  return arr;
}

export const minehead = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const sd = ctx.saveData;
    const mineFloor = Number((sd.stateR7 as any)?.[4]) || 0;
    const bonusVal = MINEHEAD_BONUS_QTY[id] || 0;
    const val = mineFloor > id ? bonusVal : 0;
    if (val <= 0)
      return node(
        label("Minehead Floor", id),
        0,
        [
          node("Mine Floor", mineFloor, null, { fmt: "raw" }),
          node("Required Floor", id, null, { fmt: "raw" }),
        ],
        { note: "minehead " + id }
      );
    return node(
      label("Minehead Floor", id),
      val,
      [
        node("Mine Floor", mineFloor, null, { fmt: "raw" }),
        node("Bonus Value", bonusVal, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "minehead " + id }
    );
  },
};
