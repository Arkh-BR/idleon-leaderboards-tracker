// ===== FOOD (the character's equipped regular food) =====
// N.js _customBlock_TotalFoodBonuses(effect) (@5079311): over the first
// FoodSlotsOwned slots of EquipmentOrder[2], every non-Blank item with a
// non-zero quantity whose ItemDefinitions Effect equals `effect` adds
//   Amount · FoodBonuses(Effect + "EffectBonus").
// FoodSlotsOwned is set on spawn (@15072643) as
//   round(2 + GemItemsPurchased[59] + floor(Tasks[2][2][0] / 2)).
// ponytail: FoodBonuses (@4104779) is taken as 1 — verified against N.js:
// only "HealthEffectBonus" and "...BoostsEffectBonus" scale (their own
// GoldFoodBonuses/BoxRewards/etc. formula); "...ForgeEffectBonus" returns 1,
// "...ForgeCooldownBonus" returns 1 − GetBribeBonus/100, "...OreRedux..."
// returns 0, and every other key falls through to 1 — including
// "ClassEXPEffectBonus", so this port is exact for Class EXP as written.
// Only Health/Boosts/Forge/OreRedux effects would need that multiplier
// ported before they could call this helper.
import { equipOrderData, equipQtyData } from "../../../save/data";
import { ITEMS } from "../../data/game/items.js";
import type { SaveData } from "../../../state";

export function foodSlotsOwned(s: SaveData): number {
  const gem59 = Number((s.gemItemsData as any)?.[59]) || 0;
  const merit = Number((s.tasksGlobalData as any)?.[2]?.[2]?.[0]) || 0;
  return Math.round(2 + gem59 + Math.floor(merit / 2));
}

export function totalFoodBonuses(effect: string, ci: number, s: SaveData): number {
  const order = (equipOrderData as any)?.[ci]?.[2] ?? {};
  const qty = (equipQtyData as any)?.[ci]?.[2] ?? {};
  const slots = foodSlotsOwned(s);
  let sum = 0;
  for (let f = 0; f < slots; f++) {
    if (order[f] === "Blank" || Number(qty[f]) === 0) continue;
    const item = (ITEMS as Record<string, any>)[String(order[f])];
    if (item?.Effect === effect) sum += Number(item.Amount) || 0;
  }
  return sum;
}
