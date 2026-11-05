import { asNum, asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { MealINFO } from "../data";
import { hString } from "../hstring";
import { listAt } from "../lists";
import { CookingR } from "./CookingR";
import { Summoning } from "./Summoning";
import { Summoning2 } from "./Summoning2";
import type { Ported } from "../ported";

/**
 * `DNSM.MealBonusesS[key]`, the map `TalentCalc(-6)` @4510244 rebuilds: each of the 74 meals g adds, under its bonus MealINFO[g][5], its
 * level Meals[0][g] x its per-level value MealINFO[g][2], times (all but "PxLine") its Cook Master multi, the meal multi
 * (CookingMealBonusMultioo) and its Ribbon (Ribbon[28 + g]).
 */
function mealBonusesS(ctx: Ctx, key: string): number {
  const meals = MealINFO as unknown as readonly (readonly unknown[])[];
  listAt(ctx, "Meals", 0); // the game indexes Meals[0][g] directly
  let total: number | undefined;
  for (let g = 0; g < 74; g++) {
    const k = hString(meals[g][5]);
    if (k !== key) continue;
    const v =
      "PxLine" == k
        ? asNum(ctx, "Meals", 0, g) * asNumber(meals[g][2])
        : Summoning2(ctx, "BonusMultiCook", g, 0) *
          CookingR(ctx, "CookingMealBonusMultioo", 0, 0) *
          Summoning(ctx, "RibbonBonus", asNum(ctx, "Ribbon", Math.round(28 + g)), 0) *
          asNum(ctx, "Meals", 0, g) *
          asNumber(meals[g][2]);
    total = v + asNumber(total);
  }
  return asNumber(total);
}

/** N.js `_customBlock_MealBonus(d)` @5162988: the meals' bonus `d`, from `DNSM.MealBonusesS` (built by `TalentCalc(-6)` when absent). */
export const MealBonus = block("MealBonus", (ctx, d: string) => mealBonusesS(ctx, d));

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
