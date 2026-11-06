import { asNum, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { NotPorted } from "../errors";
import type { Ported } from "../ported";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { chipBonuses } from "./chipBonuses";
import { Companions } from "./Companions";
import { Divinity } from "./Divinity";
import { DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { EtcBonuses } from "./EtcBonuses";
import { FlurboShop } from "./FlurboShop";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetSetBonus } from "./GetSetBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { GuildBonuses } from "./GuildBonuses";
import { Holes2 } from "./Holes2";
import { prayersReal } from "./prayersReal";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Shrine } from "./Shrine";
import { Summoning } from "./Summoning";
import { TalentCalc } from "./TalentCalc";
import { bundleAsNum, haveBan } from "./Thingies";
import { Windwalker } from "./Windwalker";

/**
 * N.js `_customBlock_AFKgainrates(d)` @4443869: the AFK gains rate of kind `d`. Only "Fighting" is ported.
 *
 * Order, as the game runs it: the prelude (DNSM.AFKgainzzDNz / ALL / ALLmulti reset; the W2 merit puts 2 in ALL; the `"Fighting" != d`
 * block, which a Fighting call skips, @4444275), then the ALL terms @4445xxx, the bun_u bundle (+30 to ALL, @4446xxx), the MULTI factor, and
 * the Fighting branch: the rate `(.4 + Σ/100) x MULTI`, replaced by `.2 x` that on map 306, and by the Cove's rate on map 216 in cavern 17;
 * the result is never below .01. The three DNSM scratch values are locals here (the game rewrites them on every call).
 *
 * `CurrentMap` is `ctx.map` (Ruling V). The page's rule for a target that is not a fight (decision A9) is `afkFightRate` in trackers/afkGains.ts.
 */
export const AFKgainrates: (ctx: Ctx, d: string) => number = block("AFKgainrates", (ctx, d: string) => {
  if ("Fighting" != d) throw new NotPorted("AFKgainrates", d);
  // prelude: `Tasks[2][1][2] > GetPlayersUsernames.indexOf(UserInfo[0])` (the current character's index) is the W2 merit
  let all = asNum(ctx, "Tasks", 2, 1, 2) > ctx.player ? 2 : 0;
  // the ALL terms, in N.js order and with N.js's parentheses (@4445xxx): the nesting decides the float rounding, and the panel shows
  // floor(100 x rate)
  all =
    all +
    (ArcadeBonus(ctx, 6) + (Windwalker(ctx, "CompassBonus", 57, 0) + GetSetBonus(ctx, "VOID_SET", "Bonus", 0, 0)) +
      (FlurboShop(ctx, 7) +
        (30 * Divinity(ctx, "Bonus_MAJOR", ctx.player, 0) +
          (Divinity(ctx, "Bonus_Minor", -1, 5) +
            (Companions(ctx, 6) + Companions(ctx, 25) + Shrine(ctx, 8) +
              (TalentCalc(ctx, 650) +
                (Summoning(ctx, "WinBonus", 11, 0) +
                  (GoldFoodBonuses(ctx, "AllAFK") +
                    (1.5 * RunCodeOfTypeXforThingY(ctx, "CardLv", "w6d3") +
                      (Summoning(ctx, "RooBonuses", 5, 0) +
                        (Summoning(ctx, "VotingBonusz", 6, 0) + (20 * Summoning(ctx, "EventShopOwned", 5, 0) + Summoning(ctx, "VaultUpgBonus", 23, 0)))))))))))));
  const multi = (1 + ArcaneType(ctx, "ArcaneMapMulti_bon", 2, 0) / 100) * (1 + EtcBonuses(ctx, "92") / 100);
  // `1 == BundlesReceived.bun_u`: read through haveBan, an absent BundlesReceived is the loader's empty map (Ruling H)
  if (1 == haveBan(ctx, "bun_u")) all = all + 30;
  // the Fighting rate's Σ, with N.js's parentheses (@4446xxx); the .4 sits outside the /100
  const sum =
    DNSM_FamBonusQTYs(ctx, "8") + DNSM_BoxRewards(ctx, "fightAFK") + GetTalentNumber(ctx, 1, 88) + GetBribeBonus(ctx, "3") +
    (GetTalentNumber(ctx, 1, 268) + CardSetBonuses(ctx, 0, "10") +
      (GetTalentNumber(ctx, 1, 448) +
        (GetTalentNumber(ctx, 1, 621) +
          (all +
            (CardBonusREAL(ctx, 43) +
              (GetTalentNumber(ctx, 1, 79) +
                (EtcBonuses(ctx, "20") + EtcBonuses(ctx, "59") +
                  (DNSM_StarSigns(ctx, "FightAFK") +
                    (GuildBonuses(ctx, 4) + (prayersReal(ctx, 4, 0) - prayersReal(ctx, 12, 1) + (chipBonuses(ctx, "fafk") + RunCodeOfTypeXforThingY(ctx, "CardLv", "w6d1"))))))))))));
  let rate = (0.4 + sum / 100) * multi;
  // @4444xxx: map 306 (the Clamworks) takes a fifth
  if (306 == ctx.map) rate = 0.2 * (0.4 + sum / 100) * multi;
  // map 216 with the character in cavern 17 (Holes[0][player]): the Cove's rate replaces it, bundle +30% (`Math.min(1, c.asNumber(bun_u))`, read as N.js does, not through haveBan's `== 1`)
  if (216 == ctx.map && 17 == attr(ctx, "Holes", 0, ctx.player)) rate = Holes2(ctx, "Cglunko_AFKgains", 0, 0) * (1 + (30 * Math.min(1, bundleAsNum(ctx, "bun_u"))) / 100);
  return Math.max(0.01, rate);
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { Fighting: true };
