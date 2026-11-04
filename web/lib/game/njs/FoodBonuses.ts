import { block, type Ctx } from "../ctx";
import { NotPorted } from "../errors";
import { ArbitraryCode } from "./ArbitraryCode";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { DNSM_BoxRewards, DNSM_StarSigns } from "./DNSM";
import { Dungon } from "./Dungon";
import { EtcBonuses } from "./EtcBonuses";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_FoodBonuses(d)` @4125641: what a food's effect is multiplied by, by the effect's name (`<Effect>EffectBonus` or
 * `...CooldownBonus`). The whole function, but the two dungeon branches (DungeonStat), not ported.
 */
export const FoodBonuses: (ctx: Ctx, d: string) => number = block("FoodBonuses", (ctx, d: string) => {
  // @4125681: the health foods
  if ("HealthEffectBonus" == d) {
    if (-1 != Dungon(ctx)) throw new NotPorted("FoodBonuses", `CurrentMap=${ctx.map}`);
    return (
      GoldFoodBonuses(ctx, "HealthFoods") +
      (DNSM_BoxRewards(ctx, "HealthFoodEffect") +
        (ArbitraryCode(ctx, "StatueBonusGiven3") +
          (EtcBonuses(ctx, "9") + (StampBonusOfTypeX(ctx, "HFood") + (DNSM_StarSigns(ctx, "FoodEffect") + CardSetBonuses(ctx, 0, "1")))))) /
        100
    );
  }
  if ("HealthCooldownBonus" == d || -1 != d.indexOf("ForgeEffectBonus")) return 1;
  if (-1 != d.indexOf("ForgeCooldownBonus")) return 1 - GetBribeBonus(ctx, "9") / 100;
  // the boost foods (HpBaseBoosts and the like)
  if (-1 != d.indexOf("BoostsEffectBonus")) {
    if (-1 != Dungon(ctx)) throw new NotPorted("FoodBonuses", `CurrentMap=${ctx.map}`);
    return (
      1 +
      (DNSM_BoxRewards(ctx, "PowerFoodEffect") +
        (ArbitraryCode(ctx, "StatueBonusGiven3") +
          (EtcBonuses(ctx, "9") +
            (StampBonusOfTypeX(ctx, "BFood") +
              (DNSM_StarSigns(ctx, "FoodEffect") + (CardBonusREAL(ctx, 48) + (CardSetBonuses(ctx, 0, "1") + GetTalentNumber(ctx, 1, 631)))))))) /
        100
    );
  }
  if (-1 != d.indexOf("BoostsCooldownBonus")) return 1;
  if (-1 != d.indexOf("OreRedux")) return 0;
  return 1;
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
