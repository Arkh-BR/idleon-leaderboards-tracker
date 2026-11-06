import { asNum, attr } from "../attr";
import { block, type Ctx, withPlayer } from "../ctx";
import { MapAFKtarget } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { contains, listAt } from "../lists";
import type { Ported } from "../ported";
import { AchieveStatus } from "./AchieveStatus";
import { ArbitraryCode } from "./ArbitraryCode";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { Breeding } from "./Breeding";
import { Bubbastuff } from "./Bubbastuff";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { CompLV2 } from "./CompLV2";
import { Companions } from "./Companions";
import { Divinity } from "./Divinity";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_StarSigns } from "./DNSM";
import { Dreamstuff } from "./Dreamstuff";
import { EtcBonuses } from "./EtcBonuses";
import { FarmingStuffs } from "./FarmingStuffs";
import { FlurboShop } from "./FlurboShop";
import { GamingStatType } from "./GamingStatType";
import { GetSetBonus } from "./GetSetBonus";
import { GetTalentNumber } from "./GetTalentNumber";
import { getLOG } from "./getLOG";
import { getbonus2 } from "./getbonus2";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { Holes } from "./Holes";
import { Holes2 } from "./Holes2";
import { JellyOperation } from "./JellyOperation";
import { Labb } from "./Labb";
import { MealBonus } from "./MealBonus";
import { MenagerieStuff } from "./MenagerieStuff";
import { Minehead } from "./Minehead";
import { prayersReal } from "./prayersReal";
import { ResearchStuff } from "./ResearchStuff";
import { RoyalG } from "./RoyalG";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { SaltLick } from "./SaltLick";
import { Shrine } from "./Shrine";
import { Spelunk } from "./Spelunk";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import { Summoning2 } from "./Summoning2";
import { SushiStuff } from "./SushiStuff";
import { haveBan, Thingies } from "./Thingies";
import { TotalFoodBonuses } from "./TotalFoodBonuses";
import { TotalStats } from "./TotalStats";
import { Windwalker } from "./Windwalker";
import { WorkbenchStuff } from "./WorkbenchStuff";

/**
 * N.js `_customBlock_ExpMulti(d)` @4260536: the Class EXP multiplier (`d` = 0, the Player Info "Class EXP"); `999` is
 * `Summoning("WinBonus", 23, 0)`, the one other branch the closure reaches. The skill EXP multipliers (d = 1..) are not ported.
 *
 * The game keeps its working values in `DNSM.ExpGainLUK` .. `ExpGainLUK6` and rewrites them on every call, so they are locals here, in the
 * game's order: LUK = the LUK curve; LUK2 = the flat % points (the lowest-level bonus, the level ladders, the weekly boss, Divinity, the
 * 5-piece card set); LUK3 = the EXP percent factor (Super Bit 19, the bun_q bundle); LUK4 = the Compass / Hole / Win / Grimoire / Vault sum;
 * LUK5 = the product of the groups; LUK6 = the second sum. The float order and the parenthesis nesting are N.js's.
 *
 * Map rules: `CurrentMap` (`ctx.map`) is read only by the Shiny Medallion gate and by the leaves that take the map themselves (the Arcane
 * map bonus slot, Shrine, the Dungon stand-in of Ruling Y). The gate is `ActorEvents_713._GenINFO[17]` (set once per map load from the static
 * `MapAFKtarget[CurrentMap]` @13142888 raw, Ruling II: never the character's saved AFK target): 1 when Compass[3] holds the monster of
 * this map, and then the product takes `max(1, getbonus2(1, 429, -1))` (the Shiny Medallion talent). A map whose target is no monster
 * ("Z", "Filler", a town, a dungeon) holds no medallion: the gate is 0 and nothing throws.
 */
export const ExpMulti: (ctx: Ctx, d: number) => number = block("ExpMulti", (ctx, d: number) => {
  if (999 == d) return Summoning(ctx, "WinBonus", 23, 0);
  if (0 != d) throw new NotPorted("ExpMulti", `d=${d}`);
  const c = ctx;
  // the LUK curve (TotalStats("LUK") first, then the curve over 1000)
  const luk = TotalStats(c, "LUK");
  const exp1 = 1e3 > luk ? (Math.pow(luk + 1, 0.37) - 1) / 30 : 0.8 * ((luk - 1e3) / (luk + 2500)) + 0.3963;
  let exp2 = 0;
  let exp3 = 0;
  // the lowest-level loop: Tasks[2][0][2] > 0 and every other character's level above this one's (a strict `<`); the last index runs the block
  if (0 < asNum(c, "Tasks", 2, 0, 2)) {
    for (let e = 0, f = c.state.charNames.length; e < f; ) {
      const i = e++;
      const b = c.player != i ? asNum(c, "Lv0", 0) < asNum(withPlayer(c, i), "Lv0", 0) : true;
      if (!b) break;
      if (Math.round(i + 1) == f) {
        exp2 = 3 * asNum(c, "Tasks", 2, 0, 2) + Summoning(c, "VaultUpgBonus", 12, 0);
        if (1 == GamingStatType(c, "SuperBitType", 19, 0)) exp3 = 50;
      }
    }
  }
  if (50 > asNum(c, "Lv0", 0)) exp2 = exp2 + CardSetBonuses(c, 0, "0");
  if (120 > asNum(c, "Lv0", 0)) exp2 = exp2 + MealBonus(c, "Clexp");
  const weekly = attr(c, "WeeklyBoss"); // the game reads WeeklyBoss.h directly: a save without it is refused, not a TypeError
  if (weekly === undefined) throw new MissingSaveKey("WeeklyBoss");
  if (weekly === null || typeof weekly !== "object") throw new InvalidSaveValue("WeeklyBoss", "a map", weekly);
  if (Object.hasOwn(weekly, "c")) exp2 = exp2 + Math.min(150, asNum(c, "WeeklyBoss", "c"));
  if (10 > asNum(c, "Lv0", 0)) exp2 = exp2 + 150;
  else if (30 > asNum(c, "Lv0", 0)) exp2 = exp2 + 100;
  else if (50 > asNum(c, "Lv0", 0)) exp2 = exp2 + 50;
  exp2 = exp2 + Divinity(c, "Bonus_Minor", c.player, 4);
  exp2 = exp2 + CardSetBonuses(c, 0, "5");
  if (1 == haveBan(c, "bun_q")) exp3 = exp3 + 20;
  const exp4 =
    Windwalker(c, "CompassBonus", 51, 0) +
    (Holes(c, "B_UPG", 47, 0) +
      (ExpMulti(c, 999) +
        (Summoning(c, "GrimoireUpgBonus", 24, 0) +
          (Summoning(c, "VaultUpgBonus", 3, 0) + (Summoning(c, "VaultUpgBonus", 35, 0) * getLOG(c, asNum(c, "OptionsListAccount", 345)) + Holes(c, "B_UPG", 83, 40))))));
  let exp5 = 1;
  // the Shiny Medallion gate (GenINFO[17], Ruling II)
  if (contains(attr(c, "Compass", 3), (MapAFKtarget as unknown as readonly unknown[])[c.map | 0])) exp5 = exp5 * Math.max(1, getbonus2(c, 1, 429, -1));
  exp5 =
    exp5 *
    Math.max(
      1,
      (1 + 9 * Companions(c, 37)) *
        (1 + Companions(c, 33)) *
        (1 + 4 * Companions(c, 160)) *
        (1 + Companions(c, 32)) *
        (1 + 0.2 * Breeding(c, "PetArenaCrucBonus", "0", 15, 0)) *
        (1 + MenagerieStuff(c, "BoostQTY", 23, 0) / 100) *
        (1 + 0.4 * Companions(c, 168)) *
        (1 + Companions(c, 34)) *
        (1 + Companions(c, 145)) *
        (1 + JellyOperation(c, "RoG_BonusQTY", 30, 0) / 100) *
        (1 + JellyOperation(c, "RoG_BonusQTY", 62, 0) / 100) *
        (1 + (Math.min(0.5, Companions(c, 128)) + 0.25 * CompLV2(c, 128))) *
        (1 + (ResearchStuff(c, "Grid_Bonus", 130, 0) + (ResearchStuff(c, "Grid_Bonus", 131, 0) + (ResearchStuff(c, "Grid_Bonus", 132, 0) + ResearchStuff(c, "Grid_Bonus", 152, 0)))) / 100) *
        (1 + FarmingStuffs(c, "StickerBonus", 0, 0) / 100) *
        (1 + 0.1 * GamingStatType(c, "SuperBitType", 63, 0)) *
        (1 + Thingies(c, "ZenithMarketBonus", 9, 0) / 100) *
        Math.max(1, Math.min(1.01, 1 + Companions(c, 50) / 2500))
    ) *
    (1 + EtcBonuses(c, "84") / 100) *
    (1 + CardBonusREAL(c, 100) / 100) *
    (1 + ArcadeBonus(c, 60) / 100) *
    (1 + DNSM_AlchVials(c, "7classexp") / 100) *
    Math.pow(Math.max(1, getbonus2(c, 1, 434, -1)), Windwalker(c, "TotalTitanKills", 0, 0));
  exp5 =
    exp5 *
    (1 + ArcaneType(c, "ArcaneMapMulti_bon", 1, 0) / 100) *
    (1 + Spelunk(c, "BigFishBonuses", 4, 0) / 100) *
    (1 + Thingies(c, "DancingCoralBonus", 3, 0) / 100) *
    Math.pow(1 + Thingies(c, "CoralKidUpgBonus", 2, 0) / 100, Math.max(0, asNum(c, "Divinity", 25) - 10)) *
    (1 + CardSetBonuses(c, 0, "12") / 100) *
    (1 + Bubbastuff(c, "BubbaRoG_Bonuses", 6, 0) / 100) *
    (1 + SushiStuff(c, "RoG_BonusQTY", 15, 0) / 100) *
    (1 + (5 * Dreamstuff(c, "CloudBonus", 70)) / 100) *
    (1 + Holes2(c, "Fountain_BonTOT", 0, 16) / 100) *
    (1 + RoyalG(c, "StatueBon", 3, 0) / 100);
  exp5 = exp5 * Math.max(1, Math.pow(1.03, listAt(c, "Spelunk", 6).length) * GamingStatType(c, "SuperBitType", 24, 0) * (1 + Summoning2(c, "MeritocBonusz", 27, 0) / 100));
  const exp6 =
    2 * RunCodeOfTypeXforThingY(c, "CardLv", "springEvent1") +
    (Companions(c, 3) +
      Companions(c, 50) +
      (asNum(c, "OptionsListAccount", 179) * Dreamstuff(c, "AllShimmerBonuses", 0) +
        (GoldFoodBonuses(c, "ClassEXPz") +
          (Summoning(c, "OwlBonuses", 0, 0) +
            (Summoning(c, "VotingBonusz", 15, 0) +
              (Holes(c, "MonumentROGbonuses", 1, 6) +
                (exp4 +
                  (GetSetBonus(c, "IRON_SET", "Bonus", 0, 0) +
                    (FarmingStuffs(c, "ExoticBonusQTY", 50, 0) +
                      (asNum(c, "OptionsListAccount", 421) +
                        (StampBonusOfTypeX(c, "classxp") +
                          (Thingies(c, "FriendBonusStatz", 1, 0) +
                            (Companions(c, 47) + (Companions(c, 111) + (Minehead(c, "Button_Bonuses", 8, 0) + Companions(c, 128))))))))))))))));
  return (
    WorkbenchStuff(c, "AdditionExtraEXPnDR", 0, 0) *
    (1 + exp3 / 100) *
    exp5 *
    (1 + EtcBonuses(c, "78") / 100) *
    (1 +
      ((exp1 * (1 + GetTalentNumber(c, 1, 35) / 100)) / 1.8 +
        (EtcBonuses(c, "4") +
          (DNSM_BoxRewards(c, "monsterExp") +
            (TotalFoodBonuses(c, "ClassEXP") +
              DNSM_StarSigns(c, "MainXP") +
              (DNSM_AlchVials(c, "MonsterEXP") +
                (DNSM_AlchBubbles(c, "expACTIVE") +
                  (CardBonusREAL(c, 44) +
                    (exp2 +
                      (ArbitraryCode(c, "StatueBonusGiven10") +
                        (GetTalentNumber(c, 1, 632) +
                          (Shrine(c, 5) +
                            (SaltLick(c, 3) +
                              (prayersReal(c, 0, 0) +
                                (prayersReal(c, 2, 0) -
                                  prayersReal(c, 9, 1) +
                                  FlurboShop(c, 2) +
                                  (AchieveStatus(c, 57) +
                                    20 * AchieveStatus(c, 357) +
                                    (3 * AchieveStatus(c, 61) +
                                      (2 * AchieveStatus(c, 124) +
                                        (5 * AchieveStatus(c, 188) +
                                          (ArcadeBonus(c, 12) +
                                            (Labb(c, "SigilBonus", "Blank", 8, 0) +
                                              (25 * AchieveStatus(c, 286) +
                                                (Breeding(c, "ShinyBonusS", "Nah", 1, -1) +
                                                  (GamingStatType(c, "MSA_Bonus", 4, 0) + (getbonus2(c, 1, 55, -1) + exp6)))))))))))))))))))))))
        / 100))
  );
});

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = [0, 999];
