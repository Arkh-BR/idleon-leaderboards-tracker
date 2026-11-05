import { asNum, asNumber, attr } from "../attr";
import { block, runtime, type Ctx } from "../ctx";
import { ClassStatTypes } from "../data";
import { InvalidSaveValue, NotPorted } from "../errors";
import { hString } from "../hstring";
import { listAt, listOrMapAt } from "../lists";
import { traceNode } from "../trace";
import { AchieveStatus } from "./AchieveStatus";
import { ArbitraryCode } from "./ArbitraryCode";
import { ArcadeBonus } from "./ArcadeBonus";
import { ArcaneType } from "./ArcaneType";
import { AtomCollider } from "./AtomCollider";
import { Breeding } from "./Breeding";
import { Bubbastuff } from "./Bubbastuff";
import { CardBonusREAL } from "./CardBonusREAL";
import { CardSetBonuses } from "./CardSetBonuses";
import { chipBonuses } from "./chipBonuses";
import { Companions } from "./Companions";
import { Divinity } from "./Divinity";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "./DNSM";
import { Dreamstuff } from "./Dreamstuff";
import { Dungon } from "./Dungon";
import { EtcBonuses } from "./EtcBonuses";
import { FarmingStuffs } from "./FarmingStuffs";
import { FoodBonuses } from "./FoodBonuses";
import { GamingStatType } from "./GamingStatType";
import { GetBribeBonus } from "./GetBribeBonus";
import { GetBuffBonuses } from "./GetBuffBonuses";
import { GetSetBonus } from "./GetSetBonus";
import { getbonus2 } from "./getbonus2";
import { getLOG } from "./getLOG";
import { GetTalentNumber } from "./GetTalentNumber";
import { GoldFoodBonuses } from "./GoldFoodBonuses";
import { Holes } from "./Holes";
import { Holes2 } from "./Holes2";
import { JellyOperation } from "./JellyOperation";
import { Labb } from "./Labb";
import { Log2 } from "./Log2";
import { MainframeBonus } from "./MainframeBonus";
import { MealBonus } from "./MealBonus";
import { Minehead } from "./Minehead";
import { Ninja } from "./Ninja";
import { PlayerHPmax } from "./PlayerHPmax";
import { PlayerMPmax } from "./PlayerMPmax";
import { PlayerSpeedBonus } from "./PlayerSpeedBonus";
import { prayersReal } from "./prayersReal";
import { ResearchStuff } from "./ResearchStuff";
import { ReturnClasses } from "./ReturnClasses";
import { RiftStuff } from "./RiftStuff";
import { RoyalG } from "./RoyalG";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Sailing } from "./Sailing";
import { SaltLick } from "./SaltLick";
import { Shrine } from "./Shrine";
import { Spelunk } from "./Spelunk";
import { StampBonusOfTypeX } from "./StampBonusOfTypeX";
import { Summoning } from "./Summoning";
import { Summoning2 } from "./Summoning2";
import { SushiStuff } from "./SushiStuff";
import { TalentCalc } from "./TalentCalc";
import { haveBan, Thingies } from "./Thingies";
import { itemDef, TotalStats } from "./TotalStats";
import { Windwalker } from "./Windwalker";
import { WorkbenchStuff } from "./WorkbenchStuff";
import type { Ported } from "../ported";

const DUNGEON = "dungeon stat, not counted";

/**
 * N.js `_customBlock_DamageDealed(d)` @4105019: the damage range of the character panel, "Min~Max". "Max" is the product of three
 * entries (DN.DamageDealtLIST), each soft-capped in the game's order; "Mastery" is the share of Max a hit is at least; "Min" is
 * Max x Mastery. Before them, in this order: a dungeon answers with the dungeon run's own stats (DungeonStat, which exist only during
 * a run), the Royal Guardian arena (map 43) with its rat damage and a flat .2 mastery, and the masterclass forms with their own. The
 * dungeon and the forms are not counted (the Damage page's product decision): runtime leaves, never a silent 0. "RNG", one random hit
 * between the two, is not ported; any other name is 0 in the game, NotPorted here.
 */
export const DamageDealed: (ctx: Ctx, d: string) => number = block("DamageDealed", (ctx, d: string) => {
  if ("Min" != d && "Max" != d && "Mastery" != d) throw new NotPorted("DamageDealed", d);
  // @4105976
  if ("Min" == d) return DamageDealed(ctx, "Max") * DamageDealed(ctx, "Mastery");
  // @4106070
  if (-1 != Dungon(ctx)) return "Mastery" == d ? Math.min(0.8, runtime(ctx, "DungeonStat(MASTERY)", DUNGEON)) : runtime(ctx, "DungeonStat(DMG)", DUNGEON);
  // @4106216
  if (43 == ctx.map) return "Mastery" == d ? 0.2 : RoyalG(ctx, "RatDMG", 0, 0);
  // @4106332, @4106509, @4106688: the forms' own Grimoire_*, Compass_* and Arcane_* stats (each form is a runtime 0)
  if (1 == Summoning(ctx, "GrimoireWraith", 0, 0)) throw new Error("unreachable");
  if (1 == Windwalker(ctx, "CompassTempest", 0, 0)) throw new Error("unreachable");
  if (1 == ArcaneType(ctx, "TesseractArcanist", 0, 0)) throw new Error("unreachable");
  // @4106867
  if ("Mastery" == d)
    return Math.min(0.8, 0.35 - GetTalentNumber(ctx, 2, 113) / 100 + (DNSM_AlchBubbles(ctx, "Mastery") + (CardBonusREAL(ctx, 21) + (GetTalentNumber(ctx, 1, 123) + EtcBonuses(ctx, "21")))) / 100);
  return max(ctx); // @4107133, cached in DNSM.TotStatMAP.MaxDmg812 (here the block cache)
});

/** @4107133: Max, DN.DamageDealtLIST[0] x [1] x [2]: the base damage, the damage % and the multipliers. */
function max(ctx: Ctx): number {
  // @4107309: the primary stat of the character's first class (ClassStatTypes), times its talents and bubbles (DN.DamageDealtSTATtype)
  const first = `${ReturnClasses(attr(ctx, "CharacterClass") as number)[0]}`;
  const types = ClassStatTypes[first];
  // the game indexes ClassStatTypes[class][0] directly and would throw on a class it does not have
  if (!types) throw new RangeError(`DamageDealed: no class ${first} in ClassStatTypes`);
  const statType =
    TotalStats(ctx, hString(types[0])) *
    (1 +
      (GetTalentNumber(ctx, 1, 95) +
        (GetTalentNumber(ctx, 1, 455) + GetTalentNumber(ctx, 1, 20)) +
        (DNSM_AlchBubbles(ctx, "W6") + (DNSM_AlchBubbles(ctx, "A6") + DNSM_AlchBubbles(ctx, "M6")))) /
        100);
  const L: number[] = [];

  // @4107948: the base damage
  L.push(
    Math.pow(
      (TotalStats(ctx, "Weapon_Power") * (1 + (GetTalentNumber(ctx, 1, 97) + (GetTalentNumber(ctx, 1, 277) + (GetTalentNumber(ctx, 1, 457) + Holes(ctx, "CosmoBonusQTY", 2, 4)))) / 100) +
        GetTalentNumber(ctx, 1, 5)) /
        3,
      2
    ) +
      (statType + GoldFoodBonuses(ctx, "BaseDamage") + Math.min(150, 2 * TotalStats(ctx, "Weapon_Power") + statType)) +
      (ArcadeBonus(ctx, 0) + (Summoning(ctx, "OwlBonuses", 1, 0) + (Summoning(ctx, "VaultUpgBonus", 0, 0) + Summoning(ctx, "VaultUpgBonus", 20, 0) * Summoning(ctx, "VaultKillzTotal", 5, 0))))
  );
  // @4108789
  L[0] =
    L[0] +
    (StampBonusOfTypeX(ctx, "BaseDmg") +
      EtcBonuses(ctx, "16") +
      ArbitraryCode(ctx, "StatueBonusGiven0") +
      (DNSM_BoxRewards(ctx, "basedmg") +
        (DNSM_AlchBubbles(ctx, "bdmgHP") * getLOG(ctx, Math.max(PlayerHPmax(ctx) - 250, 1)) +
          DNSM_AlchBubbles(ctx, "bdmgSPD") * (Log2(ctx, Math.max(PlayerSpeedBonus(ctx) - 0.1, 0)) / 0.25) +
          (DNSM_AlchBubbles(ctx, "bdmgMP") * getLOG(ctx, Math.max(PlayerMPmax(ctx) - 150, 1)) +
            (CardBonusREAL(ctx, 4) + (Labb(ctx, "SigilBonus", "Blank", 4, 0) + RunCodeOfTypeXforThingY(ctx, "CardLv", "fallEvent2")))))));
  // @4109718: the soft cap, x^.91 past 4000 and then x^.84 past 15000
  if (4e3 < L[0]) {
    L[0] = 4e3 + Math.max(Math.pow(L[0] - 4e3, 0.91), 0);
    if (15e3 < L[0]) L[0] = 15e3 + Math.max(Math.pow(L[0] - 15e3, 0.84), 0);
  }
  // @4110296: the base damage foods, after the cap: TotalFoodBonuses("BaseDmgBoosts") written out in DamageDealed (DN.DDoTdn)
  let foods = 0;
  for (let r = 0, g = (attr(ctx, "FoodSlotsOwned") as number) | 0; r < g; r++) {
    const name = attr(ctx, "EquipmentOrder", 2, r);
    if (!("Blank" != name && 0 != (attr(ctx, "EquipmentQuantity", 2, r) as number))) continue; // both loose, as the game has them
    const food = itemDef(hString(name)); // DN.DDoTmap
    if ("BaseDmgBoosts" == food.Effect) foods = foods + asNumber(food.Amount) * FoodBonuses(ctx, `${hString(food.Effect)}EffectBonus`);
  }
  L[0] = L[0] + foods;

  // @4111563: the damage %
  L.push(
    1 +
      (Math.pow(statType, 0.7) +
        (Summoning(ctx, "VaultUpgBonus", 27, 0) * Summoning(ctx, "VaultKillzTotal", 6, 0) +
          Summoning(ctx, "VaultUpgBonus", 15, 0) * asNum(ctx, "OptionsListAccount", 338) +
          (0.4 * Summoning(ctx, "VaultUpgBonus", 10, 0) + GetBribeBonus(ctx, "30")) +
          GetBribeBonus(ctx, "20") +
          (StampBonusOfTypeX(ctx, "PctDmg") + FarmingStuffs(ctx, "LankRankUpgBonus", 14, 0) + ArbitraryCode(ctx, "StatueBonusGiven22") + GetTalentNumber(ctx, 1, 113)) +
          (getLOG(ctx, PlayerHPmax(ctx)) * GetTalentNumber(ctx, 1, 86) +
            (getLOG(ctx, PlayerMPmax(ctx)) * GetTalentNumber(ctx, 1, 446) +
              (Summoning(ctx, "OwlBonuses", 2, 0) +
                (Summoning(ctx, "RooBonuses", 4, 0) +
                  (Bubbastuff(ctx, "BubbaRoG_Bonuses", 4, 0) + (Summoning(ctx, "VaultUpgBonus", 80, 0) + Spelunk(ctx, "ShopUpgBonus", 64, 0))))))))) /
        100
  );
  // @4112687: the PlayerSpeedBonus terms are multipliers (1.75 = 175%): talent 290 counts the steps of .15 above 1
  L[1] =
    L[1] *
    (1 + GetTalentNumber(ctx, 1, 284) * (Math.min(100, asNum(ctx, "Lv0", 2)) / 10) / 100) *
    (1 + Summoning(ctx, "WinBonus", 0, 0) / 100) *
    (1 +
      (GetTalentNumber(ctx, 2, 463) * Math.floor(minigameHiscore(ctx, 0) / 25) +
        (DNSM_AlchBubbles(ctx, "W12") +
          (DNSM_AlchBubbles(ctx, "A12") + DNSM_AlchBubbles(ctx, "M12")) +
          TalentCalc(ctx, 31) +
          TalentCalc(ctx, 110) +
          GetTalentNumber(ctx, 1, 125) * TalentCalc(ctx, 125) +
          TalentCalc(ctx, 485) +
          (TalentCalc(ctx, 305) / 50 + (TalentCalc(ctx, 470) / 10 + Holes(ctx, "B_UPG", 57, 0))) +
          GetTalentNumber(ctx, 1, 290) * Math.floor(Math.min(PlayerSpeedBonus(ctx) - 1, 10) / 0.15) +
          (TalentCalc(ctx, 656) +
            getLOG(ctx, asNum(ctx, "OptionsListAccount", 161)) * GetTalentNumber(ctx, 1, 649) +
            (getLOG(ctx, asNum(ctx, "OptionsListAccount", 71)) * GetTalentNumber(ctx, 1, 638) + Math.min(ArbitraryCode(ctx, "TotalQuestsComplete"), GetTalentNumber(ctx, 1, 658)))) +
          // GetPlayersUsernames.indexOf(UserInfo[0]): the current character
          Divinity(ctx, "Bonus_Minor", ctx.player, 7))) /
        100) *
    GoldFoodBonuses(ctx, "Damage");

  // @4114294: the multipliers
  L.push(
    WorkbenchStuff(ctx, "AdditionExtraDMG", 0, 0) *
      (1 + DNSM_AlchVials(ctx, "7dmg") / 100) *
      (1 + RiftStuff(ctx, "eclipseSkulls", 0) / 100) *
      (1 + GamingStatType(ctx, "PaletteBonus", 34, 0) / 100) *
      (1 + asNum(ctx, "Dream", 6) / 10) *
      (1 + Ninja(ctx, "PristineBon", 0, 0) / 100) *
      (1 + Summoning(ctx, "SummUpgBonus", 79, 0) / 100) *
      (1 + Holes2(ctx, "Cglunko_upgBon", 19, 0) / 100) *
      (1 +
        (GetBuffBonuses(ctx, 108, 2) +
          Thingies(ctx, "FriendBonusStatz", 0, 0) +
          (DNSM_StarSigns(ctx, "PctDmg") +
            (Math.max(0, asNum(ctx, "Divinity", 25) - 10) * getbonus2(ctx, 1, 507, -1) + Math.floor(Math.max(0, asNum(ctx, "Lv0", 0) - 200) / 50) * getbonus2(ctx, 1, 50, -1)))) /
          100) *
      (1 +
        (Summoning(ctx, "GrimoireUpgBonus", 35, 0) +
          GetSetBonus(ctx, "LUSTRE_SET", "Bonus", 0, 0) +
          Shrine(ctx, 0) +
          Holes(ctx, "MonumentROGbonuses", 0, 6) +
          (DNSM_BoxRewards(ctx, "12c") + (DNSM_BoxRewards(ctx, "21c") + DNSM_BoxRewards(ctx, "23c")) + DNSM_FamBonusQTYs(ctx, "20")) +
          (Sailing(ctx, "ArtifactBonus", 25, 0) +
            (AtomCollider(ctx, "AtomBonuses", 9, 0) +
              (Breeding(ctx, "ShinyBonusS", "Nah", 5, -1) +
                (GamingStatType(ctx, "MSA_Bonus", 0, 0) +
                  (asNum(ctx, "OptionsListAccount", 178) * Dreamstuff(ctx, "AllShimmerBonuses", 0) +
                    (FarmingStuffs(ctx, "CropSCbonus", 0, 0) + Summoning(ctx, "VaultUpgBonus", 41, 0) * getLOG(ctx, asNum(ctx, "OptionsListAccount", 346))))))))) /
          100) *
      (1 +
        (RiftStuff(ctx, "RiftSkillETC", 0) +
          DNSM_AlchBubbles(ctx, "pctDmg1") +
          (DNSM_AlchBubbles(ctx, "pctDmg2") +
            (DNSM_AlchBubbles(ctx, "pctDmg3") +
              (Sailing(ctx, "ArtifactBonus", 2, 0) +
                (Sailing(ctx, "ArtifactBonus", 8, 0) +
                  (DNSM_AlchBubbles(ctx, "W5") * Math.floor(Math.max(TotalStats(ctx, "STR"), TotalStats(ctx, "LUK")) / 250) +
                    DNSM_AlchBubbles(ctx, "A5") * Math.floor(TotalStats(ctx, "AGI") / 250) +
                    (DNSM_AlchBubbles(ctx, "M5") * Math.floor(TotalStats(ctx, "WIS") / 250) +
                      (WorkbenchStuff(ctx, "ConstMasteryBonus", 1, 0) +
                        (Summoning(ctx, "TomeBonus", 0, 0) +
                          (Windwalker(ctx, "CompassBonus", 48, 0) + (FarmingStuffs(ctx, "ExoticBonusQTY", 41, 0) + asNum(ctx, "OptionsListAccount", 419)))))))))))) /
          100) *
      (1 +
        (GetTalentNumber(ctx, 1, 6) +
          (SaltLick(ctx, 9) + (EtcBonuses(ctx, "45") + prayersReal(ctx, 15, 0))) +
          (MainframeBonus(ctx, 0) +
            (MainframeBonus(ctx, 11) + MainframeBonus(ctx, 110)) +
            (Sailing(ctx, "ArtifactBonus", 27, 0) +
              (Sailing(ctx, "ArtifactBonus", 29, 0) + (Holes(ctx, "B_UPG", 84, 100) + (ArcadeBonus(ctx, 46) + asNum(ctx, "OptionsListAccount", 435))))))) /
          100) *
      (1 + (Companions(ctx, 10) + Companions(ctx, 156) + (CardBonusREAL(ctx, 42) + CardSetBonuses(ctx, 0, "5"))) / 100) *
      (1 +
        (20 * Breeding(ctx, "PetArenaBonus", "0", 2, 0) +
          40 * Breeding(ctx, "PetArenaBonus", "0", 15, 0) +
          (chipBonuses(ctx, "dmg") + MealBonus(ctx, "TotDmg")) +
          2 * AchieveStatus(ctx, 58) +
          3 * AchieveStatus(ctx, 59) +
          (5 * AchieveStatus(ctx, 60) + 5 * AchieveStatus(ctx, 62)) +
          2 * AchieveStatus(ctx, 119) +
          3 * AchieveStatus(ctx, 120) +
          (5 * AchieveStatus(ctx, 121) +
            4 * AchieveStatus(ctx, 189) +
            2 * AchieveStatus(ctx, 185) +
            3 * AchieveStatus(ctx, 186) +
            (5 * AchieveStatus(ctx, 187) +
              (AchieveStatus(ctx, 240) + AchieveStatus(ctx, 280)) +
              3 * AchieveStatus(ctx, 297) +
              (2 * AchieveStatus(ctx, 303) + (2 * AchieveStatus(ctx, 364) + (4 * AchieveStatus(ctx, 354) + 3 * AchieveStatus(ctx, 375)))) +
              (Divinity(ctx, "BlesssBonus", 7, 0) + Divinity(ctx, "BlesssBonus", 8, 0))))) /
          100) *
      Math.max((1 - GetTalentNumber(ctx, 1, 24) / 100) * (1 - GetBuffBonuses(ctx, 124, 2) / 100) * Math.max(0.01, 1 - (prayersReal(ctx, 6, 1) + prayersReal(ctx, 13, 1)) / 100), 0.05)
  );
  // @4118934
  L[2] =
    L[2] *
    (1 + Minehead(ctx, "BonusQTY", 0, 0) / 100) *
    (1 + Minehead(ctx, "WepPowDmgPCT", 0, 0) / 100) *
    (1 + JellyOperation(ctx, "RoG_BonusQTY", 37, 0) / 100) *
    (1 + RoyalG(ctx, "StatueBon", 0, 0) / 100) *
    Math.pow(1 + Thingies(ctx, "CoralKidUpgBonus", 11, 0) / 100, Math.max(0, asNum(ctx, "Divinity", 25) - 35));
  // @4119435: the weekly boss, once WeeklyBoss has its "g"
  if (Object.hasOwn(listOrMapAt(ctx, "WeeklyBoss"), "g")) L[2] = L[2] * (1 + Math.min(150, asNum(ctx, "WeeklyBoss", "g")) / 100);
  // @4119765: a beginner (class 2) carrying the Elderly Peanut (Quest47) before the Cactolyte quest hits half
  if (0 == (attr(ctx, "QuestComplete", "Cactolyte3") as number) && 2 == (attr(ctx, "CharacterClass") as number) && 1 <= itemsOwned(ctx, "Quest47")) L[2] = 0.5 * L[2];

  // @4120180: the soft caps of the damage %: x^.86 past 100, then sqrt past 2e6 and ^.3 past 1e8 of the ratio
  if (100 < L[1]) L[1] = 100 + Math.max(Math.pow(L[1] - 100, 0.86), 0);
  if (2e6 < L[1]) L[1] = 2e6 * Math.pow(L[1] / 2e6, 0.5);
  if (1e8 < L[1]) L[1] = 1e8 * Math.pow(L[1] / 1e8, 0.3);
  // @4121017: and of the multipliers, past 100, 2e7, 5e8, 2e9, 15e9 and 6e10
  if (100 < L[2]) L[2] = 100 + Math.max(Math.pow(L[2] - 100, 0.86), 0);
  if (2e7 < L[2]) L[2] = 2e7 * Math.pow(L[2] / 2e7, 0.8);
  if (5e8 < L[2]) L[2] = 5e8 * Math.pow(L[2] / 5e8, 0.6);
  if (2e9 < L[2]) L[2] = 2e9 * Math.pow(L[2] / 2e9, 0.45);
  if (15e9 < L[2]) L[2] = 15e9 * Math.pow(L[2] / 15e9, 0.36);
  if (6e10 < L[2]) L[2] = 6e10 * Math.pow(L[2] / 6e10, 0.28);

  // @4122686: the multipliers after the caps
  L[2] =
    L[2] *
    (1 + EtcBonuses(ctx, "72") / 100) *
    (1 + EtcBonuses(ctx, "75") / 100) *
    (1 + EtcBonuses(ctx, "104") / 100) *
    (1 + Summoning(ctx, "VotingBonusz", 1, 0) / 100) *
    (1 + Holes2(ctx, "Fountain_BonTOT", 1, 16) / 100) *
    (1 + SushiStuff(ctx, "RoG_BonusQTY", 49, 0) / 100) *
    (1 + 0.1 * GamingStatType(ctx, "SuperBitType", 64, 0)) *
    (1 + 10 * Math.floor((96 + asNum(ctx, "OptionsListAccount", 232)) / 100) / 100) *
    (1 + CardBonusREAL(ctx, 96) / 100) *
    Math.max(1, FarmingStuffs(ctx, "StickerDMGmulti", 0, 0)) *
    (1 + (Summoning(ctx, "TomeBonus", 6, 0) + (AchieveStatus(ctx, 371) + AchieveStatus(ctx, 384))) / 100) *
    (1 + Math.max(0, Math.min(2, RiftStuff(ctx, "KillroyDMG", 0) / 100)));
  // @4123586
  L[2] =
    L[2] *
    Math.max(1, (1 + Companions(ctx, 12)) * (1 + Companions(ctx, 33)) * (1 + 2 * Companions(ctx, 160)) * (1 + 0.5 * Companions(ctx, 168)) * (1 + Companions(ctx, 170))) *
    (1 + Math.min(1.5 * RunCodeOfTypeXforThingY(ctx, "CardLv", "Crystal6"), 15) / 100) *
    (1 + Summoning2(ctx, "MeritocBonusz", 5, 0) / 100) *
    (1 + Math.min(100, Labb(ctx, "TotalGreenSigils", "0", 0, 0) * ResearchStuff(ctx, "Grid_Bonus", 127, 0)) / 100);
  // @4124196: the damage bundle (an absent BundlesReceived is the loader's empty map, Ruling H)
  if (1 == haveBan(ctx, "bon_a")) L[2] = 1.5 * L[2];
  // @4124419
  L[2] = L[2] * (1 + DNSM_FamBonusQTYs(ctx, "80") / 100);
  // @4124657: carrying the Unstable Reliquarium raises the multipliers to the power 4 / (5 + OptionsListAccount[473])
  if (1 == Thingies(ctx, "ReliquariumInPosession", 0, 0)) L[2] = Math.pow(L[2], 4 / (5 + asNum(ctx, "OptionsListAccount", 473)));
  // @4124958: the Clamworks (map 306) divide them by 100^Menagerie[5][2]
  if (306 == ctx.map) {
    listAt(ctx, "Menagerie", 5); // the game indexes Menagerie[5][2] directly
    L[2] = L[2] / Math.pow(100, asNum(ctx, "Menagerie", 5, 2));
  }
  // @4125287
  return L[0] * L[1] * L[2];
}

/**
 * `FamilyValuesMap.MinigameHiscores[b]`. The loader fills each FamilyValuesMap key `e` from the save key "FamVal" + e (`getLoadList` for
 * MinigameHiscores, @19929053), a loop SAVE_ATTRS cannot name: read from FamValMinigameHiscores. The game reads it with c.asNumber.
 */
function minigameHiscore(ctx: Ctx, b: number): number {
  const key = "FamValMinigameHiscores";
  const list = ctx.state.get(key); // MissingSaveKey when the save lacks it
  if (!Array.isArray(list)) throw new InvalidSaveValue(key, "an array", list);
  if (list[b] === undefined && ctx.trace) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, "(absent)", [`${key}[${b}]`], 0, "absent: asNumber(null) = 0"));
  return asNumber(list[b]);
}

/**
 * `ActorEvents_29._ItemsOwnedMap[item]`: the current character's inventory (InventoryOrder) summed by name over ItemQuantity, which the
 * inventory actor builds when it starts (@7075609) and again on every change (CountInventory @7042726). The game reads it with c.asNumber.
 */
function itemsOwned(ctx: Ctx, item: string): number {
  let n = 0;
  const order = listAt(ctx, "InventoryOrder");
  for (let e = 0; e < order.length; e++) if ("Blank" != order[e] && item == hString(order[e])) n = n + asNum(ctx, "ItemQuantity", e);
  return n;
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = { Max: true, Mastery: true, Min: true };
