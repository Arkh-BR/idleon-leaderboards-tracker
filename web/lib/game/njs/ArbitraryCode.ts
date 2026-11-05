import { asNum, asNumber, attr } from "../attr";
import { assumed, block, withPlayer, type Ctx } from "../ctx";
import { SceneNPCquestOrder, StatueInfo } from "../data";
import { listAt } from "../lists";
import { hString } from "../hstring";
import { NotPorted } from "../errors";
import { AchieveStatus } from "./AchieveStatus";
import { CardBonusREAL } from "./CardBonusREAL";
import { Companions } from "./Companions";
import { DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs } from "./DNSM";
import { FarmingStuffs } from "./FarmingStuffs";
import { GetSetBonus } from "./GetSetBonus";
import { getbonus2 } from "./getbonus2";
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
import { Summoning2 } from "./Summoning2";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/**
 * `StatueBonusGiven<n>` @4039757: statue n's bonus, its level StatueLevels[n][0] (the character's) times its value StatueInfo[n][3], then:
 * the class talents that boost it (112 and 127 for 0, 2, 7, 8; 292 and 307 for 1, 9, 11, 14; 487 and 472 for 6, 10, 12, 13; 37 for 3, 5,
 * 17; each statue skipping one of its pair, as written), x2 + Artifact 30 as an Onyx statue (StatueG[n] >= 2), x1.5 + Zenith Market 0 as
 * a Zenith one (>= 3), Vault 25 for 0, 1, 2 and 6, statue 29's bonus for every other statue, then the Event Shop 19, the best talent 56
 * and the Meritoc bonus 26.
 */
function statueBonusGiven(ctx: Ctx, n: number): number {
  const info = (StatueInfo as unknown as readonly (readonly unknown[])[])[n];
  // the game indexes StatueInfo[n][3] and StatueLevels[n][0] directly and would throw on a statue it does not have
  if (!info) throw new RangeError(`ArbitraryCode StatueBonusGiven: no statue ${n} in StatueInfo`);
  listAt(ctx, "StatueLevels", n);
  let v = asNum(ctx, "StatueLevels", n, 0) * asNumber(info[3]); // DNSM.statuearbDN
  const talent = (t: number) => Math.max(1 + GetTalentNumber(ctx, 1, t) / 100, 1);
  if (0 == n || 2 == n || 8 == n || 7 == n) {
    if (7 != n) v = v * talent(112);
    if (8 != n) v = v * talent(127);
  } else if (1 == n || 11 == n || 9 == n || 14 == n) {
    if (14 != n) v = v * talent(292);
    if (9 != n) v = v * talent(307);
  } else if (10 == n || 6 == n || 12 == n || 13 == n) {
    if (13 != n) v = v * talent(487);
    if (12 != n) v = v * talent(472);
  } else if (3 == n || 5 == n || 17 == n) v = v * talent(37);
  if (2 <= asNum(ctx, "StatueG", n | 0)) v = v * Math.max(1 + (100 + Sailing(ctx, "ArtifactBonus", 30, 0)) / 100, 1);
  if (3 <= asNum(ctx, "StatueG", n | 0)) v = v * Math.max(1 + (50 + Thingies(ctx, "ZenithMarketBonus", 0, 0)) / 100, 1);
  if (0 == n || 1 == n || 2 == n || 6 == n) v = v * Math.max(1 + Summoning(ctx, "VaultUpgBonus", 25, 0) / 100, 1);
  if (29 != n) v = v * Math.max(1 + ArbitraryCode(ctx, "StatueBonusGiven29") / 100, 1);
  return v * (1 + 0.3 * Summoning(ctx, "EventShopOwned", 19, 0)) * Math.max(1 + getbonus2(ctx, 1, 56, -1) / 100, 1) * (1 + Summoning2(ctx, "MeritocBonusz", 26, 0) / 100);
}

/** N.js `_customBlock_ArbitraryCode(d)` @4009050: one function, a chain of named sub-cases. Only the sub-cases the character stats reach. */
export const ArbitraryCode: (ctx: Ctx, d: string) => number = block("ArbitraryCode", (ctx, d: string) => {
  if ("StatueBonusGiven" == d.substring(0, 16)) return statueBonusGiven(ctx, Math.round(asNumber(d.substring(16, d.length))));
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
      return assumed(ctx, "TotalQuestsComplete", "the game takes DNSM.TomeQTY[4] once the Tome actor has built it (about 100 ms into the session), else the HUD's quest list; the quest replay stands for both", n);
    }
    default:
      throw new NotPorted("ArbitraryCode", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  AllStat: true,
  AllStatPCT: true,
  TotalQuestsComplete: true,
  StatueBonusGiven: true,
  // the name carries the statue (`StatueBonusGiven14`): one entry per statue, so the inventory marks each call
  ...Object.fromEntries((StatueInfo as unknown as readonly unknown[]).map((_, n) => [`StatueBonusGiven${n}`, true as const])),
};
