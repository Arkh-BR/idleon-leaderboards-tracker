// ===== COMPANIONS SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/companions.js.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { companionBonus } from "../../data/common/companions";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function companions(idx: number, saveData: SaveData): number {
  if (!saveData.companionIds || !saveData.companionIds.has(idx)) return 0;
  return companionBonus(idx);
}

export const companion = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const name = label("Companion", id);
    const owned = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(id)
      : false;
    const bonusVal = companionBonus(id);
    const val = owned ? bonusVal : 0;
    if (!owned) {
      return node(
        name,
        0,
        [
          node("Not owned", 0, null, { fmt: "raw" }),
          node("Would grant", bonusVal, null, {
            fmt: "+",
            note: "if owned",
          }),
        ],
        { note: "Not owned — would grant +" + bonusVal }
      );
    }
    return node(
      name,
      val,
      [
        node("Owned", 1, null, { fmt: "raw" }),
        node("Bonus", bonusVal, null, { fmt: "+" }),
      ],
      { fmt: "+" }
    );
  },
};

export const compMulti = {
  resolve(id: number, ctx: Ctx, args?: number[]): CorganNode {
    const cap = args ? args[0] : 1;
    const divisor = args ? args[1] : 1;
    const name = label("Companion", id);
    const owned = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(id)
      : false;
    const bonusVal = owned ? companionBonus(id) : 0;
    const raw = divisor > 1 ? bonusVal / divisor : bonusVal;
    const val = Math.max(1, Math.min(cap, 1 + raw));
    return node(
      name,
      val,
      [
        node(owned ? "Owned" : "Not owned", 0, null, { fmt: "raw" }),
        node("Raw bonus", bonusVal, null, { fmt: "+" }),
        node("Cap", cap, null, { fmt: "x" }),
        node("Result", val, null, { fmt: "x" }),
      ],
      { fmt: "x" }
    );
  },
};
