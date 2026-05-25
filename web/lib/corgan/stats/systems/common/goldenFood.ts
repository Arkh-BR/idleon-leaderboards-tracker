// ===== GOLDEN FOOD SYSTEM =====
// Pragmatic port of corgan-source/js/stats/systems/common/goldenFood.js.
//
// The original gfoodBonusMULTI() folds ~25 sources (etcBonus 8, talent 99,
// stamp GFood, alch bubble GFood, sigil 14, meal Golden Food, star signs
// 69, bribe 36, pristine 14, achievements 37/380/383, voting bonus 26,
// talent 209, companions 48/155, legend PTS 25, card cropfallEvent1,
// vault 86 + multipliers from secret set bonus and FamBonus66) — almost
// every cross-system. Porting that whole chain belongs in Stage 4; for
// Stage 2 we stub the multi to a flat 1.0 and surface only the base
// equipped-food + emporium-food contributions. This *underestimates* the
// DR value but never overestimates — once Stage 4 lands, the multi will
// be plugged in and parity will return.

import { node, type CorganNode } from "../../../node";
import { equipOrderData, equipQtyData } from "../../../save/data";
import { getLOG } from "../../../formulas";
import { GOLD_FOOD_INFO, EMPORIUM_FOOD_SLOTS } from "../../data/common/goldenFood";
import type { SaveData } from "../../../state";

type Ctx = {
  saveData: SaveData;
  charIdx: number;
  resolve?: (descId: string) => { val: number; children?: CorganNode[] } | null;
};

export function gfoodBonusMULTI(
  _charIdx: number,
  _opts: unknown,
  _saveData: SaveData
): number {
  // Stage 4 TODO: port the 25-source chain. Returning 1 keeps the formula
  // shape intact (`amount * multi * 0.05 * lg * (1 + lg / 2.14)`).
  return 1;
}

type GoldFoodResult = {
  total: number;
  equipped: {
    item: string;
    amount: number;
    qty: number;
    lg: number;
    val: number;
  } | null;
  emporium: {
    item: string;
    amount: number;
    empLevel: number;
    effQty: number;
    lg: number;
    val: number;
  } | null;
};

export function goldFoodBonuses(
  effectType: string,
  charIdx: number,
  preMulti: number | undefined,
  saveData: SaveData
): GoldFoodResult {
  const multi = preMulti != null ? preMulti : gfoodBonusMULTI(charIdx, null, saveData);
  let total = 0;
  let equippedInfo: GoldFoodResult["equipped"] = null;
  let emporiumInfo: GoldFoodResult["emporium"] = null;

  const foodBag =
    ((equipOrderData as any)[charIdx] && (equipOrderData as any)[charIdx][2]) || {};
  const qtyBag =
    ((equipQtyData as any)[charIdx] && (equipQtyData as any)[charIdx][2]) || {};

  for (let i = 0; i < 16; i++) {
    const itemName = (foodBag as any)[i] || "Blank";
    if (itemName === "Blank") continue;
    const info = GOLD_FOOD_INFO[itemName];
    if (!info || info.effect !== effectType) continue;
    const qty = Number((qtyBag as any)[i]) || 0;
    const lg = getLOG(1 + qty);
    const val = info.amount * multi * 0.05 * lg * (1 + lg / 2.14);
    total = val;
    equippedInfo = { item: itemName, amount: info.amount, qty, lg, val };
  }

  // Emporium (account-wide global food)
  const ninja104 = saveData.ninjaData && saveData.ninjaData[104];
  const empUnlocked = Array.isArray(ninja104)
    ? (ninja104 as any[]).some((v) => Number(v) > 0)
    : true;
  if (empUnlocked) {
    for (let i = 0; i < EMPORIUM_FOOD_SLOTS.length; i++) {
      const itemName = EMPORIUM_FOOD_SLOTS[i];
      const info = GOLD_FOOD_INFO[itemName];
      if (!info || info.effect !== effectType) continue;
      const empLevel =
        Number(((saveData.ninjaData && (saveData.ninjaData[104] as any)) || [])[i]) || 0;
      if (empLevel > 0) {
        const effQty = 1000 * Math.pow(10, empLevel);
        const lg = getLOG(1 + effQty);
        const val = info.amount * multi * 0.05 * lg * (1 + lg / 2.14);
        total += val;
        emporiumInfo = { item: itemName, amount: info.amount, empLevel, effQty, lg, val };
      }
    }
  }

  return { total, equipped: equippedInfo, emporium: emporiumInfo };
}

export const goldenFood = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const gfm = ctx.resolve ? ctx.resolve("gfood-multi") : null;
    const multi = gfm ? gfm.val : undefined;
    const result = goldFoodBonuses(id, ctx.charIdx, multi, ctx.saveData);
    const total = result ? result.total : 0;
    if (total <= 0) return node("Golden Food: " + id, 0);

    const children: CorganNode[] = [];

    // GFood multi (stage-2 stub returns 1; descriptor path will eventually
    // pass in the real value via ctx.resolve('gfood-multi')).
    if (gfm) {
      children.push(node("GFood Multi", gfm.val, gfm.children, { fmt: "x" }));
    } else {
      children.push(
        node("GFood Multi", multi ?? 1, null, {
          fmt: "x",
          note: "stage4 stub (will inflate this once gfoodBonusMULTI ports)",
        })
      );
    }

    if (result.equipped) {
      const e = result.equipped;
      children.push(
        node(
          "Equipped: " + e.item,
          e.val,
          [
            node("Base Amount", e.amount, null, { fmt: "raw" }),
            node("Quantity", e.qty, null, { fmt: "raw" }),
            node("Log Factor", e.lg, null, { fmt: "raw" }),
          ],
          { fmt: "raw" }
        )
      );
    }
    if (result.emporium) {
      const em = result.emporium;
      children.push(
        node(
          "Emporium: " + em.item,
          em.val,
          [
            node("Base Amount", em.amount, null, { fmt: "raw" }),
            node("Emporium Lv", em.empLevel, null, { fmt: "raw" }),
            node("Eff Qty", em.effQty, null, { fmt: "raw" }),
          ],
          { fmt: "raw" }
        )
      );
    }

    return node("Golden Food: " + id, total, children, { fmt: "+" });
  },
};
