// Task 2 (EXP plan): every leaf of ExpMulti(0) (N.js _customBlock_ExpMulti(0) @4260536, the Class EXP multiplier), by EXP_GROUPS source id. Each
// term below is the N.js sub-expression of its source, written in the representation the leaf has in its group: a FACTOR for the mult groups
// (`1 + Companions(37) x 9`), the % points a pct group sums (g02, g09, g10). The table covers every source of the page's descriptor.
import { describe, it, expect } from "vitest";
import { EXP_GROUPS } from "@/lib/expMulti/layers";
import { asNum, attr } from "@/lib/game/attr";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { contains, listAt } from "@/lib/game/lists";
import { MapAFKtarget } from "@/lib/game/data";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { getLOG } from "@/lib/game/njs/getLOG";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { Windwalker } from "@/lib/game/njs/Windwalker";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { FlurboShop } from "@/lib/game/njs/FlurboShop";
import { Divinity } from "@/lib/game/njs/Divinity";
import { Companions } from "@/lib/game/njs/Companions";
import { CompLV2 } from "@/lib/game/njs/CompLV2";
import { Shrine } from "@/lib/game/njs/Shrine";
import { Summoning } from "@/lib/game/njs/Summoning";
import { Summoning2 } from "@/lib/game/njs/Summoning2";
import { haveBan } from "@/lib/game/njs/Thingies";
import { Thingies } from "@/lib/game/njs/Thingies";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { Breeding } from "@/lib/game/njs/Breeding";
import { MenagerieStuff } from "@/lib/game/njs/MenagerieStuff";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { Bubbastuff } from "@/lib/game/njs/Bubbastuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { StampBonusOfTypeX } from "@/lib/game/njs/StampBonusOfTypeX";
import { Minehead } from "@/lib/game/njs/Minehead";
import { MealBonus } from "@/lib/game/njs/MealBonus";
import { TotalFoodBonuses } from "@/lib/game/njs/TotalFoodBonuses";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { SaltLick } from "@/lib/game/njs/SaltLick";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { Labb } from "@/lib/game/njs/Labb";

/** The loop @4261156 of ExpMulti: Tasks[2][0][2] > 0 and every other character's level above this one's (a strict `<`; the last index runs the block). */
function lowestLevel(c: Ctx): boolean {
  if (!(0 < asNum(c, "Tasks", 2, 0, 2))) return false;
  for (let e = 0, n = c.state.charNames.length; e < n; e++) {
    const b = c.player != e ? asNum(c, "Lv0", 0) < asNum(withPlayer(c, e), "Lv0", 0) : true;
    if (!b) return false;
    if (e + 1 == n) return true;
  }
  return false;
}
/** DNSM.ExpGainLUK after its curve (`1E3 > LUK ? (pow(LUK + 1, .37) - 1) / 30 : .8 x ((LUK - 1e3) / (LUK + 2500)) + .3963`). */
function lukCurve(c: Ctx): number {
  const luk = TotalStats(c, "LUK");
  return 1e3 > luk ? (Math.pow(luk + 1, 0.37) - 1) / 30 : 0.8 * ((luk - 1e3) / (luk + 2500)) + 0.3963;
}
const comp = (c: Ctx, n: number) => Companions(c, n);

/** The lib/game term of each source, as ExpMulti(0) uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // g01
  workbench: (c) => WorkbenchStuff(c, "AdditionExtraEXPnDR", 0, 0),
  // g02: ExpGainLUK3 (the % points of (1 + ExpGainLUK3 / 100))
  bunQ: (c) => (1 == haveBan(c, "bun_q") ? 20 : 0),
  superbit19: (c) => (lowestLevel(c) && 1 == GamingStatType(c, "SuperBitType", 19, 0) ? 50 : 0),
  // g03 @4264489: GenINFO[17] of the map actor (ActorEvents_713) is 1 when Compass[3] holds the monster of MapAFKtarget[CurrentMap] (set once per map load, @13142888)
  medallion429: (c) => (contains(attr(c, "Compass", 3), (MapAFKtarget as unknown as readonly unknown[])[c.map | 0]) ? Math.max(1, getbonus2(c, 1, 429, -1)) : 1),
  // g04
  comp37: (c) => 1 + 9 * comp(c, 37),
  comp33: (c) => 1 + comp(c, 33),
  comp160: (c) => 1 + 4 * comp(c, 160),
  comp32: (c) => 1 + comp(c, 32),
  arenaCruc15: (c) => 1 + 0.2 * Breeding(c, "PetArenaCrucBonus", "0", 15, 0),
  menagerie23: (c) => 1 + MenagerieStuff(c, "BoostQTY", 23, 0) / 100,
  comp168: (c) => 1 + 0.4 * comp(c, 168),
  comp34: (c) => 1 + comp(c, 34),
  comp145: (c) => 1 + comp(c, 145),
  jelly30: (c) => 1 + JellyOperation(c, "RoG_BonusQTY", 30, 0) / 100,
  jelly62: (c) => 1 + JellyOperation(c, "RoG_BonusQTY", 62, 0) / 100,
  comp128: (c) => 1 + (Math.min(0.5, comp(c, 128)) + 0.25 * CompLV2(c, 128)),
  gridExp: (c) => 1 + (ResearchStuff(c, "Grid_Bonus", 130, 0) + (ResearchStuff(c, "Grid_Bonus", 131, 0) + (ResearchStuff(c, "Grid_Bonus", 132, 0) + ResearchStuff(c, "Grid_Bonus", 152, 0)))) / 100,
  sticker0: (c) => 1 + FarmingStuffs(c, "StickerBonus", 0, 0) / 100,
  superbit63: (c) => 1 + 0.1 * GamingStatType(c, "SuperBitType", 63, 0),
  zenith9: (c) => 1 + Thingies(c, "ZenithMarketBonus", 9, 0) / 100,
  comp50: (c) => Math.max(1, Math.min(1.01, 1 + comp(c, 50) / 2500)),
  // g05
  etc84: (c) => 1 + EtcBonuses(c, "84") / 100,
  card100: (c) => 1 + CardBonusREAL(c, 100) / 100,
  arcade60: (c) => 1 + ArcadeBonus(c, 60) / 100,
  vialClassExp: (c) => 1 + DNSM_AlchVials(c, "7classexp") / 100,
  // g06
  talent434: (c) => Math.pow(Math.max(1, getbonus2(c, 1, 434, -1)), Windwalker(c, "TotalTitanKills", 0, 0)),
  // g07
  arcane1: (c) => 1 + ArcaneType(c, "ArcaneMapMulti_bon", 1, 0) / 100,
  bigFish4: (c) => 1 + Spelunk(c, "BigFishBonuses", 4, 0) / 100,
  dancingCoral3: (c) => 1 + Thingies(c, "DancingCoralBonus", 3, 0) / 100,
  coralKid: (c) => Math.pow(1 + Thingies(c, "CoralKidUpgBonus", 2, 0) / 100, Math.max(0, asNum(c, "Divinity", 25) - 10)),
  cardSet12: (c) => 1 + CardSetBonuses(c, 0, "12") / 100,
  bubba6: (c) => 1 + Bubbastuff(c, "BubbaRoG_Bonuses", 6, 0) / 100,
  sushi15: (c) => 1 + SushiStuff(c, "RoG_BonusQTY", 15, 0) / 100,
  cloud70: (c) => 1 + (5 * Dreamstuff(c, "CloudBonus", 70)) / 100,
  fountain16: (c) => 1 + Holes2(c, "Fountain_BonTOT", 0, 16) / 100,
  royalStatue3: (c) => 1 + RoyalG(c, "StatueBon", 3, 0) / 100,
  // g08
  classy: (c) => Math.max(1, Math.pow(1.03, listAt(c, "Spelunk", 6).length) * GamingStatType(c, "SuperBitType", 24, 0) * (1 + Summoning2(c, "MeritocBonusz", 27, 0) / 100)),
  // g09
  etc78: (c) => EtcBonuses(c, "78"),
  // g10 (% points of the sum over 100): the LUK curve times (1 + T35 / 100) / 1.8 is split in two
  luk: (c) => (100 * lukCurve(c)) / 1.8,
  talent35: (c) => (lukCurve(c) * GetTalentNumber(c, 1, 35)) / 1.8,
  etc4: (c) => EtcBonuses(c, "4"),
  boxMonsterExp: (c) => DNSM_BoxRewards(c, "monsterExp"),
  food: (c) => TotalFoodBonuses(c, "ClassEXP"),
  starSignMainXP: (c) => DNSM_StarSigns(c, "MainXP"),
  vialMonsterExp: (c) => DNSM_AlchVials(c, "MonsterEXP"),
  bubbleExp: (c) => DNSM_AlchBubbles(c, "expACTIVE"),
  card44: (c) => CardBonusREAL(c, 44),
  // ExpGainLUK2, in N.js order
  merit3: (c) => (lowestLevel(c) ? 3 * asNum(c, "Tasks", 2, 0, 2) : 0),
  vault12: (c) => (lowestLevel(c) ? Summoning(c, "VaultUpgBonus", 12, 0) : 0),
  cardSet0: (c) => (50 > asNum(c, "Lv0", 0) ? CardSetBonuses(c, 0, "0") : 0),
  mealClexp: (c) => (120 > asNum(c, "Lv0", 0) ? MealBonus(c, "Clexp") : 0),
  weeklyBoss: (c) => (Object.hasOwn(attr(c, "WeeklyBoss") as object, "c") ? Math.min(150, asNum(c, "WeeklyBoss", "c")) : 0),
  newbie: (c) => (10 > asNum(c, "Lv0", 0) ? 150 : 30 > asNum(c, "Lv0", 0) ? 100 : 50 > asNum(c, "Lv0", 0) ? 50 : 0),
  divMinor4: (c) => Divinity(c, "Bonus_Minor", c.player, 4),
  cardSet5: (c) => CardSetBonuses(c, 0, "5"),
  statue10: (c) => ArbitraryCode(c, "StatueBonusGiven10"),
  talent632: (c) => GetTalentNumber(c, 1, 632),
  shrine5: (c) => Shrine(c, 5),
  saltLick3: (c) => SaltLick(c, 3),
  prayer0: (c) => prayersReal(c, 0, 0),
  prayer2: (c) => prayersReal(c, 2, 0),
  prayer9: (c) => -prayersReal(c, 9, 1), // `prayersReal(2,0) - prayersReal(9,1)`
  flurbo2: (c) => FlurboShop(c, 2),
  ach57: (c) => AchieveStatus(c, 57),
  ach357: (c) => 20 * AchieveStatus(c, 357),
  ach61: (c) => 3 * AchieveStatus(c, 61),
  ach124: (c) => 2 * AchieveStatus(c, 124),
  ach188: (c) => 5 * AchieveStatus(c, 188),
  arcade12: (c) => ArcadeBonus(c, 12),
  sigil8: (c) => Labb(c, "SigilBonus", "Blank", 8, 0),
  ach286: (c) => 25 * AchieveStatus(c, 286),
  shiny1: (c) => Breeding(c, "ShinyBonusS", "Nah", 1, -1),
  msa4: (c) => GamingStatType(c, "MSA_Bonus", 4, 0),
  talent55: (c) => getbonus2(c, 1, 55, -1),
  // ExpGainLUK6
  cardSpring: (c) => 2 * RunCodeOfTypeXforThingY(c, "CardLv", "springEvent1"),
  comp3: (c) => comp(c, 3),
  comp50add: (c) => comp(c, 50),
  shimmer179: (c) => asNum(c, "OptionsListAccount", 179) * Dreamstuff(c, "AllShimmerBonuses", 0),
  goldFood: (c) => GoldFoodBonuses(c, "ClassEXPz"),
  owl0: (c) => Summoning(c, "OwlBonuses", 0, 0),
  vote15: (c) => Summoning(c, "VotingBonusz", 15, 0),
  monument1_6: (c) => Holes(c, "MonumentROGbonuses", 1, 6),
  // ExpGainLUK4 (inside ExpGainLUK6, after the monument)
  compass51: (c) => Windwalker(c, "CompassBonus", 51, 0),
  hole47: (c) => Holes(c, "B_UPG", 47, 0),
  win23: (c) => Summoning(c, "WinBonus", 23, 0), // ExpMulti(999)
  grimoire24: (c) => Summoning(c, "GrimoireUpgBonus", 24, 0),
  vault3: (c) => Summoning(c, "VaultUpgBonus", 3, 0),
  vault35: (c) => Summoning(c, "VaultUpgBonus", 35, 0) * getLOG(c, asNum(c, "OptionsListAccount", 345)),
  hole83: (c) => Holes(c, "B_UPG", 83, 40),
  ironSet: (c) => GetSetBonus(c, "IRON_SET", "Bonus", 0, 0),
  exotic50: (c) => FarmingStuffs(c, "ExoticBonusQTY", 50, 0),
  ola421: (c) => asNum(c, "OptionsListAccount", 421),
  stampClassxp: (c) => StampBonusOfTypeX(c, "classxp"),
  friend1: (c) => Thingies(c, "FriendBonusStatz", 1, 0),
  comp47: (c) => comp(c, 47),
  comp111: (c) => comp(c, 111),
  button8: (c) => Minehead(c, "Button_Bonuses", 8, 0),
  comp128add: (c) => comp(c, 128),
};

describe("the EXP term table covers every source of the page's descriptor", () => {
  it("has one term per EXP_GROUPS source, no more", () => {
    expect(Object.keys(TERMS).sort()).toEqual(EXP_GROUPS.flatMap((g) => g.sources).sort());
  });
});
