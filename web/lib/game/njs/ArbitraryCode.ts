import { asNum, asNumber, attr } from "../attr";
import { assumed, block, withPlayer, type Ctx } from "../ctx";
import { SceneNPCquestOrder, StatueInfo } from "../data";
import { listAt } from "../lists";
import { hString } from "../hstring";
import { NotPorted } from "../errors";
import { AchieveStatus } from "./AchieveStatus";
import { ArcadeBonus } from "./ArcadeBonus";
import { Breeding } from "./Breeding";
import { CardBonusREAL } from "./CardBonusREAL";
import { Companions } from "./Companions";
import { Divinity } from "./Divinity";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs } from "./DNSM";
import { EtcBonuses } from "./EtcBonuses";
import { FarmingStuffs } from "./FarmingStuffs";
import { FlurboShop } from "./FlurboShop";
import { GetSetBonus } from "./GetSetBonus";
import { getbonus2 } from "./getbonus2";
import { getLOG } from "./getLOG";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { GuildBonuses } from "./GuildBonuses";
import { Holes } from "./Holes";
import { JellyOperation } from "./JellyOperation";
import { Shrine } from "./Shrine";
import { MainframeBonus } from "./MainframeBonus";
import { MealBonus } from "./MealBonus";
import { Ninja } from "./Ninja";
import { prayersReal } from "./prayersReal";
import { ResearchStuff } from "./ResearchStuff";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Sailing } from "./Sailing";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Stuff2 } from "./Stuff2";
import { Summoning } from "./Summoning";
import { Summoning2 } from "./Summoning2";
import { SushiStuff } from "./SushiStuff";
import { TalentCalc } from "./TalentCalc";
import { bundleAsNum, Thingies } from "./Thingies";
import { TotalStats } from "./TotalStats";
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
    // @4043878: how many statues are Onyx (StatueG[n] >= 2), 0 while OptionsListAccount[69], the highest statue tier unlocked, is below 2
    case "StatueOnyxOwned": {
      if (2 > asNum(ctx, "OptionsListAccount", 69)) return 0;
      let n = 0; // DNSM.StatueOnyxOwned
      for (let e = 0, b = listAt(ctx, "StatueG").length; e < b; e++) if (2 <= asNum(ctx, "StatueG", e)) n = n + 1;
      return n;
    }
    // @4047005: the Coin multi of a monster's drop, "Total Coin Bonus from all sources" (Upgrade Vault, upgrade 2): the Cash bubbles, the 21 factors after them, the additive pool last.
    // The pool's guild term and TalentCalc(643), the multikill tier against the AFK target, are the two terms that read CurrentMap
    case "MonsterCash":
      return (
        (1 + (DNSM_AlchBubbles(ctx, "CashSTR") * Math.floor(TotalStats(ctx, "STR") / 250) + (DNSM_AlchBubbles(ctx, "CashAGI") * Math.floor(TotalStats(ctx, "AGI") / 250) + DNSM_AlchBubbles(ctx, "CashWIS") * Math.floor(TotalStats(ctx, "WIS") / 250))) / 100) *
        (1 + Math.min(4, Companions(ctx, 24))) *
        Stuff2(ctx, "CoinDropMulti", 0, 0) *
        (1 + Math.min(4, Companions(ctx, 45))) *
        (1 + Math.min(4, Companions(ctx, 159))) *
        (1 + 0.5 * Summoning(ctx, "EventShopOwned", 9, 0)) *
        (1 + 0.6 * Summoning(ctx, "EventShopOwned", 20, 0)) *
        (1 + EtcBonuses(ctx, "77") / 100) *
        (1 + SushiStuff(ctx, "RoG_BonusQTY", 18, 0) / 100) *
        (1 + SushiStuff(ctx, "RoG_BonusQTY", 37, 0) / 100) *
        (1 + (ResearchStuff(ctx, "Grid_Bonus", 149, 0) + ResearchStuff(ctx, "Grid_Bonus", 169, 0)) / 100) *
        (1 + EtcBonuses(ctx, "100") / 100) *
        (1 + GetSetBonus(ctx, "GOLD_SET", "Bonus", 0, 0) / 100) *
        (1 + Holes(ctx, "GambitBonuses", 7, 0) / 100) *
        (1 + 250 * bundleAsNum(ctx, "bun_y") / 100) *
        (1 + Math.max(1, getbonus2(ctx, 1, 433, -1)) * getLOG(ctx, asNum(ctx, "OptionsListAccount", 362)) / 100) *
        (1 + (MealBonus(ctx, "Cash") + Sailing(ctx, "ArtifactBonus", 1, 0) + (Summoning(ctx, "RooBonuses", 6, 0) + Summoning(ctx, "VotingBonusz", 34, 0))) / 100) *
        (1 + (0.5 * Breeding(ctx, "PetArenaBonus", "0", 5, 0) + Thingies(ctx, "FriendBonusStatz", 5, 0) + (Breeding(ctx, "PetArenaBonus", "0", 14, 0) + ArbitraryCode(ctx, "StatueBonusGiven19") / 100))) *
        (1 + (MainframeBonus(ctx, 9) + (Summoning(ctx, "VaultUpgBonus", 34, 0) * Summoning(ctx, "VaultKillzTotal", 8, 0) + Summoning(ctx, "VaultUpgBonus", 37, 0) * Summoning(ctx, "VaultKillzTotal", 9, 0))) / 100) *
        (1 + Ninja(ctx, "PristineBon", 16, 0) / 100) *
        (1 + prayersReal(ctx, 8, 0) / 100) *
        (1 + (Divinity(ctx, "Bonus_Minor", -1, 3) + FarmingStuffs(ctx, "CropSCbonus", 4, 0)) / 100) *
        (1 +
          (GetTalentNumber(ctx, 1, 657) +
            DNSM_AlchVials(ctx, "MonsterCash") +
            (EtcBonuses(ctx, "3") +
              (CardBonusREAL(ctx, 11) +
                7 * RunCodeOfTypeXforThingY(ctx, "CardLv", "w5b1") +
                (GetTalentNumber(ctx, 1, 22) +
                  (FlurboShop(ctx, 4) +
                    (ArcadeBonus(ctx, 10) + ArcadeBonus(ctx, 11)) +
                    (DNSM_BoxRewards(ctx, "13c") +
                      (GuildBonuses(ctx, 8) * (1 + Math.floor(ctx.map / 50)) +
                        (TalentCalc(ctx, 643) +
                          (TalentCalc(ctx, 644) +
                            (GoldFoodBonuses(ctx, "MonsterCash") +
                              Summoning(ctx, "VaultUpgBonus", 17, 0) * getLOG(ctx, asNum(ctx, "OptionsListAccount", 340)) +
                              (5 * AchieveStatus(ctx, 235) +
                                (10 * AchieveStatus(ctx, 350) +
                                  (20 * AchieveStatus(ctx, 376) +
                                    (Summoning(ctx, "VaultUpgBonus", 2, 0) +
                                      (Summoning(ctx, "VaultUpgBonus", 14, 0) * Summoning(ctx, "VaultKillzTotal", 4, 0) +
                                        (Summoning(ctx, "VaultUpgBonus", 31, 0) * Summoning(ctx, "VaultKillzTotal", 7, 0) +
                                          (asNum(ctx, "OptionsListAccount", 420) + Summoning(ctx, "VaultUpgBonus", 70, 0) * Stuff2(ctx, "CardsCollected", 0, 0)))))))))))))))))) /
            100)
      );
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
    // @4054444: the chance a kill spawns a crystal mob, read by the Tome's record of it (OptionsListAccount[202] @5740104)
    case "CrystalSpawn":
      return (
        (5 * Summoning(ctx, "EventShopOwned", 42, 0) +
          (1 + GetTalentNumber(ctx, 1, 26) / 100) *
            (1 + (DNSM_BoxRewards(ctx, "CrystalSpawn") + (Shrine(ctx, 6) + (Companions(ctx, 171) + JellyOperation(ctx, "RoG_BonusQTY", 8, 0)))) / 100) *
            (1 + GetTalentNumber(ctx, 1, 619) / 100) *
            (1 + StampBonusOfTypeX(ctx, "CrySpawn") / 100) *
            (1 + CardBonusREAL(ctx, 14) / 100)) /
        2e3
      );
    default:
      throw new NotPorted("ArbitraryCode", d);
  }
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  StatueOnyxOwned: true,
  MonsterCash: true,
  AllStat: true,
  AllStatPCT: true,
  TotalQuestsComplete: true,
  CrystalSpawn: true,
  StatueBonusGiven: true,
  // the name carries the statue (`StatueBonusGiven14`): one entry per statue, so the inventory marks each call
  ...Object.fromEntries((StatueInfo as unknown as readonly unknown[]).map((_, n) => [`StatueBonusGiven${n}`, true as const])),
};
