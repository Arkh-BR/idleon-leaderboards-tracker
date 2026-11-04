import { block } from "../ctx";
import { NotPorted } from "../errors";
import { Breeding } from "./Breeding";
import { Companions } from "./Companions";
import { MainframeBonus } from "./MainframeBonus";
import { Summoning } from "./Summoning";
import type { Ported } from "../ported";

/** N.js `_customBlock_CookingR(d, b, e)` @7889045: one function, a chain of named sub-cases. Only the sub-cases the character stats reach. */
export const CookingR = block("CookingR", (ctx, d: string, _b: number, _e: number) => {
  switch (d) {
    // @7893201: what every meal's bonus is multiplied by
    case "CookingMealBonusMultioo":
      return (
        (1 + (MainframeBonus(ctx, 116) + Breeding(ctx, "ShinyBonusS", "Nah", 20, -1)) / 100) *
        (1 + Summoning(ctx, "WinBonus", 26, 0) / 100) *
        (1 + (25 * Companions(ctx, 162)) / 100)
      );
    default:
      throw new NotPorted("CookingR", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { CookingMealBonusMultioo: true };
