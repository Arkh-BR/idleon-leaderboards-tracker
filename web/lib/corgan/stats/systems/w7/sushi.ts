// ===== SUSHI STATION SYSTEM (W7) — DR-relevant slice =====
// 1:1 port of the bits Drop Rate descriptor needs: rogBonusQTY, buildRogArray,
// sushiRoG resolver, computeUniqueSushi. Sushi economics (fuel/bucks/knowledge)
// is left for a later iteration since drop-rate doesn't query it.

import { node, type CorganNode } from "../../../node";
import { ROG_BONUS_QTY } from "../../data/w7/sushi";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function rogBonusQTY(idx: number, uniqueSushi: number): number {
  if (uniqueSushi > idx) return ROG_BONUS_QTY[idx] || 0;
  return 0;
}

export function buildRogArray(uniqueSushi: number): number[] {
  const arr = new Array(ROG_BONUS_QTY.length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = uniqueSushi > i ? ROG_BONUS_QTY[i] || 0 : 0;
  }
  return arr;
}

export const sushiRoG = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const us = saveData.cachedUniqueSushi || 0;
    const val = rogBonusQTY(id, us);
    return node(
      "RoG Bonus " + id,
      val,
      [
        node("Unique Sushi", us, null, { fmt: "raw" }),
        node("RoG Value", ROG_BONUS_QTY[id] || 0, null, {
          fmt: "raw",
          note: us > id ? "Unlocked" : "Locked (need " + (id + 1) + ")",
        }),
      ],
      { fmt: "+", note: "sushi RoG " + id }
    );
  },
};

export function computeUniqueSushi(sushiData: any): number {
  const tiers = sushiData?.[5];
  if (!Array.isArray(tiers)) return 0;
  let count = 0;
  for (let i = 0; i < tiers.length; i++) {
    if ((Number(tiers[i]) || 0) >= 0) count = i + 1;
    else break;
  }
  return count;
}
