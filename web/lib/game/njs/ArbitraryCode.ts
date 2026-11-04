import { asNum, attr } from "../attr";
import { block, withPlayer } from "../ctx";
import { SceneNPCquestOrder } from "../data";
import { hString } from "../hstring";
import { NotPorted } from "../errors";
import { AchieveStatus } from "./AchieveStatus";
import { CardBonusREAL } from "./CardBonusREAL";
import { Companions } from "./Companions";
import { DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs } from "./DNSM";
import { FarmingStuffs } from "./FarmingStuffs";
import { GetSetBonus } from "./GetSetBonus";
import { getLOG } from "./getLOG";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { GuildBonuses } from "./GuildBonuses";
import { Holes } from "./Holes";
import { MainframeBonus } from "./MainframeBonus";
import { MealBonus } from "./MealBonus";
import { Sailing } from "./Sailing";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import type { Ported } from "../ported";

/** N.js `_customBlock_ArbitraryCode(d)` @4009050: one function, a chain of named sub-cases. Only the sub-cases the character stats reach. */
export const ArbitraryCode = block("ArbitraryCode", (ctx, d: string) => {
  switch (d) {
    // @4061380: the flat bonus to every stat, the post office's 20a + the meals' Stat + guild bonus 1, rounded down
    case "AllStat":
      return Math.floor(DNSM_BoxRewards(ctx, "20a") + MealBonus(ctx, "Stat") + GuildBonuses(ctx, 1));
    // @4061538: the % bonus to every stat, to one decimal (0.1 x floor(10 x ...))
    case "AllStatPCT":
      return (
        0.1 *
        Math.floor(
          10 *
            (DNSM_AlchVials(ctx, "AllStatPCT") +
              (15 * Companions(ctx, 0) * Holes(ctx, "CosmoBonusQTY", 2, 0) +
                MainframeBonus(ctx, 104) +
                StampBonusOfTypeX(ctx, "AllStatPct") +
                (CardBonusREAL(ctx, 82) +
                  Summoning(ctx, "WinBonus", 18, 0) +
                  (DNSM_FamBonusQTYs(ctx, "72") +
                    (Sailing(ctx, "ArtifactBonus", 28, 0) +
                      (GoldFoodBonuses(ctx, "AllStatz") +
                        (AchieveStatus(ctx, 309) +
                          (Math.min(15, getLOG(ctx, asNum(ctx, "OptionsListAccount", 172)) * GetTalentNumber(ctx, 1, 653)) +
                            (AchieveStatus(ctx, 362) +
                              10 * Math.floor((98 + asNum(ctx, "OptionsListAccount", 232)) / 100) +
                              (FarmingStuffs(ctx, "LankRankUpgBonus", 19, 0) + (Summoning(ctx, "VotingBonusz", 2, 0) + GetSetBonus(ctx, "MARBIGLASS_SET", "Bonus", 0, 0))))))))))))
        )
      );
    // @4060967: the quests done, `DNSM.TomeQTY[4]` once the Tome actor's _customEvent_TomeQTY has run (every session, the Tome being
    // open or not: it fills the account's Tome counts), else the HUD's quest list. That count @5742563: the quests of SceneNPCquestOrder
    // any character has done (its QuestComplete is 1); replayed from the save
    case "TotalQuestsComplete": {
      let n = 0; // this._DummyNumber
      for (const q of SceneNPCquestOrder as unknown as readonly unknown[]) {
        for (let b = 0; b < ctx.state.charNames.length; b++) {
          if (1 == attr(withPlayer(ctx, b), "QuestComplete", hString(q))) {
            n += 1;
            break;
          }
        }
      }
      return n;
    }
    default:
      throw new NotPorted("ArbitraryCode", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { AllStat: true, AllStatPCT: true, TotalQuestsComplete: true };
