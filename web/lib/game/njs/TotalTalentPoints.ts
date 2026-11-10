import { asNum, asNumber } from "../attr";
import { block } from "../ctx";
import { NotPorted } from "../errors";
import { currency } from "../player";
import { AchieveStatus } from "./AchieveStatus";
import { Breeding } from "./Breeding";
import { Companions } from "./Companions";
import { DNSM_FamBonusQTYs } from "./DNSM";
import { FlurboShop } from "./FlurboShop";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { GuildBonuses } from "./GuildBonuses";
import { Labb } from "./Labb";
import { RandomEvent } from "./RandomEvent";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import type { Ported } from "../ported";

/**
 * N.js `_customBlock_TotalTalentPoints(d)` @4376008: the current character's talent points of the six tabs, a list, less the points spent
 * `d[tab]`. One call per tab here, `d` six 0s: the one call that reads a tab, `_customEvent_TomeQTY`'s (@5746384), passes six 0s
 * (DummyList2) and reads tab 5. Its writes to SkillLevelsMAX first (the caps of the bubble and vault talents) do not reach tab 5.
 *
 * Tab 5, the star talents (@4387868): floor(Lv0[0] - 1 + TalentDL[0] + GetTalentNumber(1, 8) + TalentDLbonus[5] + FamBonusQTYs["64"]
 * + GetTalentNumber(1, 622) + StampBonusOfTypeX("TalentS") + GetTalentNumber(1, 17) + floor(GuildBonuses(11)) + FlurboShop(1)
 * + min(5 CardLv(w4b2), 50) + min(15 CardLv(Boss2C), 100) + min(4 CardLv(fallEvent1), 100) + SigilBonus 9 + 10 Ach(212) + 20 Ach(289)
 * + 20 Ach(305) + ShinyBonusS 14 + BribeBonus("32") + 100 FractalIslandBonus(5) + VaultUpgBonus(53) + Companions(20) - d[5]), with
 * TalentDL[0] = -3 + Lv0[1..9] + round(GetTalentNumber(1, 275)) and TalentDLbonus[5] = CurrenciesOwned.TalentPoints[5] (the class
 * bubbles go to tabs 0..3 only).
 */
export const TotalTalentPoints = block("TotalTalentPoints", (ctx, tab: number) => {
  if (5 != tab) throw new NotPorted("TotalTalentPoints", `tab=${tab}`);
  let dl0 = -3; // DNSM.TalentDN4
  for (let f = 0; f < 9; f++) dl0 += asNum(ctx, "Lv0", f + 1);
  dl0 += Math.round(GetTalentNumber(ctx, 1, 275));
  const card = (name: string) => RunCodeOfTypeXforThingY(ctx, "CardLv", name);
  return Math.floor(
    asNum(ctx, "Lv0", 0) - 1 +
      (dl0 + GetTalentNumber(ctx, 1, 8) +
        (asNumber(currency(ctx, "TalentPoints", 5)) + DNSM_FamBonusQTYs(ctx, "64") +
          (GetTalentNumber(ctx, 1, 622) +
            (StampBonusOfTypeX(ctx, "TalentS") +
              (GetTalentNumber(ctx, 1, 17) +
                (Math.floor(GuildBonuses(ctx, 11)) +
                  (FlurboShop(ctx, 1) +
                    (Math.min(5 * card("w4b2"), 50) + (Math.min(15 * card("Boss2C"), 100) + Math.min(4 * card("fallEvent1"), 100)) +
                      (Labb(ctx, "SigilBonus", "Blank", 9, 0) +
                        (10 * AchieveStatus(ctx, 212) +
                          (20 * AchieveStatus(ctx, 289) +
                            (20 * AchieveStatus(ctx, 305) +
                              (Breeding(ctx, "ShinyBonusS", "Nah", 14, -1) +
                                (GetBribeBonus(ctx, "32") +
                                  (100 * RandomEvent(ctx, "FractalIslandBonus", 5, 999) + (Summoning(ctx, "VaultUpgBonus", 53, 0) + Companions(ctx, 20)))))))))))))))))
  ); // - d[5], 0
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [5];
