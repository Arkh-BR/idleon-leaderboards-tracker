// Task 2 (DR plan): every leaf of TotalStats("Drop_Rarity") (N.js _customBlock_TotalStats "Drop_Rarity" @4190432, outside a dungeon: Ruling Y),
// by DR2_GROUPS source id. Each term below is the N.js sub-expression of its source, written in the representation the leaf has in its group:
// the % points a pct group sums (the Σ of `1 + (1.4 DropRateLUK + Σ) / 100`, the post-processing `1 + x / 100` factors), a FACTOR for the mult
// groups, the amount an add group adds, the new total of the Cove (0 when it does not replace). The table covers every source of the page's
// descriptor.
import { describe, it, expect } from "vitest";
import { DR2_GROUPS } from "@/lib/dropRateV2/layers";
import { asNum, attr } from "@/lib/game/attr";
import { type Ctx } from "@/lib/game/ctx";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_FamBonusQTYs, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GuildBonuses } from "@/lib/game/njs/GuildBonuses";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Companions } from "@/lib/game/njs/Companions";
import { CompLV2 } from "@/lib/game/njs/CompLV2";
import { Shrine } from "@/lib/game/njs/Shrine";
import { Summoning } from "@/lib/game/njs/Summoning";
import { haveBan, Thingies } from "@/lib/game/njs/Thingies";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { Labb } from "@/lib/game/njs/Labb";
import { Breeding } from "@/lib/game/njs/Breeding";
import { StampBonusOfTypeX } from "@/lib/game/njs/StampBonusOfTypeX";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { Spelunk } from "@/lib/game/njs/Spelunk";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { MenagerieStuff } from "@/lib/game/njs/MenagerieStuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { Minehead } from "@/lib/game/njs/Minehead";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { Ninja } from "@/lib/game/njs/Ninja";
const COVE_MAP = 216;

/** DNSM.DropRateLUK after its curve @4190432: `1E3 > LUK ? (pow(LUK + 1, .37) - 1) / 40 : .5 x ((LUK - 1e3) / (LUK + 2500)) + .297`. */
function lukCurve(c: Ctx): number {
  const luk = TotalStats(c, "LUK");
  return 1e3 > luk ? (Math.pow(luk + 1, 0.37) - 1) / 40 : 0.5 * ((luk - 1e3) / (luk + 2500)) + 0.297;
}
const comp = (c: Ctx, n: number) => Companions(c, n);
const cardLv = (c: Ctx, card: string) => RunCodeOfTypeXforThingY(c, "CardLv", card);
/** The Cove line @4196607: `216 == CurrentMap && 17 == Holes[0][<the current character>]` (the raw element, loosely) replaces the total. */
const inCove = (c: Ctx) => COVE_MAP == c.map && 17 == attr(c, "Holes", 0, c.player);

/** The lib/game term of each source, as TotalStats("Drop_Rarity") uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // base: 1 + (1.4 x DropRateLUK + Σ) / 100 as a pct group, so the LUK source is 140 x the curve
  luk: (c) => 140 * lukCurve(c),
  talent279: (c) => GetTalentNumber(c, 1, 279),
  box11: (c) => DNSM_BoxRewards(c, "DropRate"),
  etc2: (c) => EtcBonuses(c, "2"),
  etc102: (c) => EtcBonuses(c, "102"),
  bubble: (c) => DNSM_AlchBubbles(c, "DropRate"),
  card10: (c) => CardBonusREAL(c, 10),
  talent24: (c) => GetTalentNumber(c, 1, 24),
  starSigns: (c) => DNSM_StarSigns(c, "Drop"),
  guild10: (c) => GuildBonuses(c, 10),
  cardSet5: (c) => CardSetBonuses(c, 0, "5"),
  cardSet6: (c) => CardSetBonuses(c, 0, "6"),
  shrine4: (c) => Shrine(c, 4),
  prayer7: (c) => prayersReal(c, 7, 0),
  sigil11: (c) => Labb(c, "SigilBonus", "Blank", 11, 0),
  shiny0: (c) => Breeding(c, "ShinyBonusS", "Nah", 0, -1),
  arcade27: (c) => ArcadeBonus(c, 27),
  comp3: (c) => comp(c, 3),
  comp50: (c) => comp(c, 50),
  stamp: (c) => StampBonusOfTypeX(c, "DropRate"),
  talent655: (c) => GetTalentNumber(c, 1, 655) * asNum(c, "OptionsListAccount", 189),
  dream10: (c) => 5 * asNum(c, "Dream", 10),
  win9: (c) => Summoning(c, "WinBonus", 9, 0),
  tome2: (c) => Summoning(c, "TomeBonus", 2, 0),
  // DropRateLUK2, in N.js order
  mini5a: (c) => Math.min(1.5 * cardLv(c, "mini5a"), 10),
  caveCards: (c) => Math.min(4 * cardLv(c, "caveC") + 6 * cardLv(c, "caveD"), 100),
  anni4: (c) => Math.min(2 * cardLv(c, "anni4Event1"), 20),
  luckEvent: (c) => Math.min(3 * cardLv(c, "luckEvent1"), 25),
  goldFood: (c) => GoldFoodBonuses(c, "DropRatez"),
  ach377: (c) => 6 * AchieveStatus(c, 377),
  ach381: (c) => 4 * AchieveStatus(c, 381),
  owl4: (c) => Summoning(c, "OwlBonuses", 4, 0),
  rank9: (c) => FarmingStuffs(c, "LankRankUpgBonus", 9, 0),
  vote27: (c) => Summoning(c, "VotingBonusz", 27, 0),
  hole46: (c) => Holes(c, "B_UPG", 46, 0),
  cropSC7: (c) => FarmingStuffs(c, "CropSCbonus", 7, 0),
  grimoire44: (c) => Summoning(c, "GrimoireUpgBonus", 44, 0),
  vault18: (c) => Summoning(c, "VaultUpgBonus", 18, 0),
  meas15: (c) => Holes(c, "MeasurementBonusTOTAL", 15, 0),
  comp22: (c) => comp(c, 22),
  comp158: (c) => comp(c, 158),
  hole82: (c) => Holes(c, "B_UPG", 82, 20),
  monument: (c) => Holes(c, "MonumentROGbonuses", 2, 6),
  emperor11: (c) => Thingies(c, "EmperorBon", 11, 0),
  efaunt: (c) => GetSetBonus(c, "EFAUNT_SET", "Bonus", 0, 0),
  exotic59: (c) => FarmingStuffs(c, "ExoticBonusQTY", 59, 0),
  friend3: (c) => Thingies(c, "FriendBonusStatz", 3, 0),
  legend1: (c) => Thingies(c, "LegendPTS_bonus", 1, 0),
  spelunk50: (c) => Spelunk(c, "ShopUpgBonus", 50, 0),
  comp111: (c) => comp(c, 111),
  talent239: (c) => GetTalentNumber(c, 1, 239) * (RoyalG(c, "TotalStatz", 0, 0) / 1),
  // back in Σ
  grid173: (c) => ResearchStuff(c, "Grid_Bonus", 173, 0),
  comp132: (c) => comp(c, 132),
  // the chip, an add group under 5: chipBonuses("dr") / 100
  chip: (c) => chipBonuses(c, "dr") / 100,
  bunV: (c) => (1 == haveBan(c, "bun_v") ? 2 : 0),
  workbench: (c) => WorkbenchStuff(c, "AdditionExtraEXPnDR", 0, 0),
  ola232: (c) => (1 <= asNum(c, "OptionsListAccount", 232) ? 0.3 : 0),
  bunP: (c) => (1 == haveBan(c, "bun_p") ? 1.2 : 1),
  // post-processing, % of `1 + x / 100` or a factor
  arcane: (c) => ArcaneType(c, "ArcaneMapMulti_bon", 0, 0),
  statue1: (c) => RoyalG(c, "StatueBon", 1, 0),
  menagerie24: (c) => MenagerieStuff(c, "BoostQTY", 24, 0),
  card101: (c) => CardBonusREAL(c, 101),
  family32: (c) => DNSM_FamBonusQTYs(c, "32"),
  comp168x: (c) => 1 + 0.3 * comp(c, 168),
  comp132x: (c) => 1 + (Math.min(0.5, comp(c, 132)) + 0.2 * CompLV2(c, 132)),
  sushi48: (c) => SushiStuff(c, "RoG_BonusQTY", 48, 0),
  jelly14: (c) => JellyOperation(c, "RoG_BonusQTY", 14, 0),
  glimbo: (c) => Minehead(c, "GlimboDRmulti", 0, 0), // inside Math.max(1, ·): the group is max1
  tome7: (c) => Summoning(c, "TomeBonus", 7, 0),
  etc99: (c) => EtcBonuses(c, "99"),
  minehead0: (c) => Minehead(c, "BonusQTY", 0, 0),
  cloud69: (c) => 5 * Dreamstuff(c, "CloudBonus", 69),
  pristine3: (c) => Ninja(c, "PristineBon", 3, 0),
  etc91: (c) => EtcBonuses(c, "91"),
  vial: (c) => DNSM_AlchVials(c, "7drMulto"),
  // Math.max(1, min(1.3, 1 + Companions(26)) x (1 + .5 Companions(160))): one max1 group of two factors
  comp26: (c) => Math.min(1.3, 1 + comp(c, 26)),
  comp160: (c) => 1 + 0.5 * comp(c, 160),
  comp50x: (c) => Math.min(1.01, 1 + comp(c, 50) / 2500), // inside Math.max(1, ·): the group is max1
  cove: (c) => (inCove(c) ? Holes2(c, "Cglunko_DR", 0, 0) : 0),
};

describe("the DR term table covers every source of the page's descriptor", () => {
  it("has one term per DR2_GROUPS source, no more", () => {
    expect(Object.keys(TERMS).sort()).toEqual(DR2_GROUPS.flatMap((g) => g.sources).sort());
  });
});
