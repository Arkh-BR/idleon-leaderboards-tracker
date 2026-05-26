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
    // Owned/Not-owned status is reflected by `val` itself (1× when not
    // owned, > 1× when owned), so don't add a redundant zero-val "Owned"
    // row. When not owned, swap in a single explanatory row instead.
    const children: CorganNode[] = owned
      ? [
          node("Raw bonus", bonusVal, null, { fmt: "+" }),
          node("Cap", cap, null, { fmt: "x" }),
          node("Result", val, null, { fmt: "x" }),
        ]
      : [
          node("Not owned — no contribution", 0, null, {
            fmt: "raw",
            note: `Would grant +${bonusVal} raw if owned`,
          }),
        ];
    return node(name, val, children, { fmt: "x" });
  },
};
