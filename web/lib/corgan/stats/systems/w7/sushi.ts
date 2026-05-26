// ===== SUSHI STATION SYSTEM (W7) — DR-relevant slice =====
// 1:1 port of the bits Drop Rate descriptor needs: rogBonusQTY, buildRogArray,
// sushiRoG resolver, computeUniqueSushi. Sushi economics (fuel/bucks/knowledge)
// is left for a later iteration since drop-rate doesn't query it.

import { node, type CorganNode } from "../../../node";
import { ROG_BONUS_QTY, ROG_DESC, SUSHI_NAMES } from "../../data/w7/sushi";
import type { SaveData } from "../../../state";

/** Strip the "}x_" / "{%_" placeholders the IT data uses to produce the
 *  effect text for a RoG slot, e.g. ROG_DESC[48] = "}x_Drop_Rate" → "Drop
 *  Rate". The label format is "Sushi <id> — <effect>" since each RoG slot
 *  is unlocked by reaching N unique sushi types, not by a specific named
 *  sushi (SushiUPG only goes to 45). */
function rogEffectText(idx: number): string {
  const raw = ROG_DESC[idx] || "";
  return raw
    .replace(/[\{\}]/g, "")
    .replace(/^\s*[}x]\s*/, "") // strip leading "}x " placeholder
    .replace(/^\s*[+%]+\s*/, "")
    .trim();
}

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
    const effect = rogEffectText(id);
    // Label as "<Sushi Name> Tier <N> — <effect> (RoG Bonus <id>)". RoG slot
    // index i is unlocked by creating the (i+1)-th unique sushi, so the
    // friendly tier is one-indexed. SUSHI_NAMES is indexed by RoG slot too.
    const sushiName = SUSHI_NAMES[id] || "";
    const tier = id + 1;
    const prefix = sushiName ? `${sushiName} (Sushi Tier ${tier})` : `Sushi Tier ${tier}`;
    const label = effect
      ? `${prefix} — ${effect} (RoG Bonus ${id})`
      : `${prefix} (RoG Bonus ${id})`;
    return node(
      label,
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
