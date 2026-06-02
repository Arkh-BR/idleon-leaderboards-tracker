// ===== GOLDEN FOOD DATA =====
// 1:1 port of corgan-source/js/stats/data/common/goldenFood.js.
import { ITEMS } from "../game/items.js";

export const GOLD_FOOD_DR: Record<string, number> = {};

export const EMPORIUM_FOOD_SLOTS: readonly string[] = [
  "PeanutG", "ButterBar",
  "FoodG1", "FoodG2", "FoodG3", "FoodG4", "FoodG5",
  "FoodG6", "FoodG7", "FoodG8", "FoodG9", "FoodG10",
  "FoodG11", "FoodG12", "FoodG13", "FoodG14", "FoodG15",
];

export type GoldFoodInfo = { effect: string; amount: number };

export const GOLD_FOOD_INFO: Record<string, GoldFoodInfo> = {};

const _items = ITEMS as Record<string, any>;
for (const name of EMPORIUM_FOOD_SLOTS) {
  const item = _items[name];
  if (!item) continue;
  GOLD_FOOD_INFO[name] = { effect: item.Effect, amount: Number(item.Amount) || 0 };
  if (item.Effect === "DropRatez") {
    GOLD_FOOD_DR[name] = Number(item.Amount) || 0;
  }
}
