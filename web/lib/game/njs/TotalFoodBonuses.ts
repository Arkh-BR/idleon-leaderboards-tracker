import { asNum, asNumber, attr } from "../attr";
import { block } from "../ctx";
import { hString } from "../hstring";
import { FoodBonuses } from "./FoodBonuses";
import { itemDef } from "./TotalStats";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_TotalFoodBonuses(d)` @5103314: every food slot (FoodSlotsOwned of EquipmentOrder[2]) holding a food of effect `d`
 * with a quantity adds its Amount times FoodBonuses(<its effect> + "EffectBonus").
 */
export const TotalFoodBonuses = block("TotalFoodBonuses", (ctx, d: string) => {
  let total = 0; // DNSM.playHPbasePOT2
  for (let f = 0, n = asNum(ctx, "FoodSlotsOwned") | 0; f < n; f++) {
    const name = attr(ctx, "EquipmentOrder", 2, f);
    if ("Blank" == name || 0 == attr(ctx, "EquipmentQuantity", 2, f)) continue;
    const food = itemDef(hString(name)); // DNSM.playHPbasePOT1
    if (food.Effect == d) total = total + asNumber(food.Amount) * FoodBonuses(ctx, `${hString(food.Effect)}EffectBonus`);
  }
  return total;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
