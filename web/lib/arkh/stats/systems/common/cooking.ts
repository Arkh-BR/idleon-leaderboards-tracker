// ===== COOKING — shared meal multiplier =====
// 1:1 port of corgan-source/js/stats/systems/common/cooking.js.
// Game: (1 + (MF116 + ShinyS20)/100) × (1 + WinBon26/100) × (1 + 25*Comp162/100)

import { mainframeBonus } from "../w4/lab";
import { computeShinyBonusS } from "../w4/breeding";
import { computeWinBonus } from "../w6/summoning";
import type { SaveData } from "../../../state";

export type MealMulti = {
  val: number;
  mfb116: number;
  shinyS20: number;
  winBon26: number;
  comp162: number;
};

export function cookingMealMulti(saveData: SaveData): MealMulti {
  const mfb116 = mainframeBonus(116, saveData);
  const shinyS20 = computeShinyBonusS(20, saveData);
  const winBon26 = computeWinBonus(26, null, saveData);
  const comp162 = saveData.companionIds.has(162) ? 25 : 0;
  const val =
    (1 + (mfb116 + shinyS20) / 100) * (1 + winBon26 / 100) * (1 + comp162 / 100);
  return { val, mfb116, shinyS20, winBon26, comp162 };
}
