// ===== JELLY OPERATOR SYSTEM (W7, 2026-09-18) — DR-relevant slice =====
import { node, type ArkhNode } from "../../../node";
import {
  JELLY_ROG_QTY,
  jellyLabel,
  jellyOperations,
  jellyRoGBonus,
} from "../../data/w7/jelly";
import { sushiRoG } from "./sushi";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

/** One Jelly Operator obstruction bonus as a "+" node (value in the unit the
 *  consuming formula expects — %, points, or a 0.01x step). */
export function jellyRoGNode(idx: number, saveData: SaveData): ArkhNode {
  const ops = jellyOperations(saveData);
  const val = jellyRoGBonus(idx, saveData);
  return node(
    jellyLabel(idx),
    val,
    [
      node("Successful Operations", ops, null, { fmt: "raw" }),
      node("Bonus Value", JELLY_ROG_QTY[idx] || 0, null, {
        fmt: "raw",
        note: ops > idx ? "Unlocked" : "Locked (need " + (idx + 1) + " operations)",
      }),
    ],
    { fmt: "+", note: "jelly RoG " + idx }
  );
}

export const jellyRoG = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    return jellyRoGNode(id, ctx.saveData);
  },
};

// Drop_Rarity post-multiplier: ×(1 + (SushiStuff("RoG_BonusQTY",48) +
// JellyOperation("RoG_BonusQTY",14)) / 100). The two live inside ONE
// (1 + x/100) factor in N.js, so they must be summed before the chain
// multiplies — two separate "+" items would compound as (1+a)(1+b).
export const rogDropMulti = {
  resolve(_id: unknown, ctx: Ctx): ArkhNode {
    const sushi = sushiRoG.resolve(48, ctx);
    const jelly = jellyRoGNode(14, ctx.saveData);
    const val = (Number(sushi.val) || 0) + (Number(jelly.val) || 0);
    return node(
      "Sushi + Jelly Drop Rate (RoG Bonus 48 + Jelly Bonus 14)",
      val,
      [sushi, jelly],
      { fmt: "+", note: "×(1 + (Sushi RoG 48 + Jelly RoG 14) / 100)" }
    );
  },
};
