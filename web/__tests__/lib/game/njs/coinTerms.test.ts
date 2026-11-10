// Task 2 (Coin plan): every leaf of ArbitraryCode("MonsterCash") (N.js @4047005), by COIN_GROUPS source id. Each term below is the N.js
// sub-expression of its source, written in the representation the leaf has in its group (lib/coinMulti/layers.ts): the amount a `pct` group sums
// (the Σ of `1 + Σ / 100`), the amount a `min4` or `raw` group adds to its 1. The table covers every source of the page's descriptor.
import { describe, it, expect } from "vitest";
import { COIN_GROUPS } from "@/lib/coinMulti/layers";
import { asNum } from "@/lib/game/attr";
import { type Ctx } from "@/lib/game/ctx";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards } from "@/lib/game/njs/DNSM";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { getLOG } from "@/lib/game/njs/getLOG";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GuildBonuses } from "@/lib/game/njs/GuildBonuses";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Companions } from "@/lib/game/njs/Companions";
import { Summoning } from "@/lib/game/njs/Summoning";
import { GoldFoodBonuses } from "@/lib/game/njs/GoldFoodBonuses";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { Breeding } from "@/lib/game/njs/Breeding";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Divinity } from "@/lib/game/njs/Divinity";
import { Ninja } from "@/lib/game/njs/Ninja";
import { FlurboShop } from "@/lib/game/njs/FlurboShop";
import { MealBonus } from "@/lib/game/njs/MealBonus";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { Stuff2 } from "@/lib/game/njs/Stuff2";
import { Holes } from "@/lib/game/njs/Holes";
import { Sailing } from "@/lib/game/njs/Sailing";
import { bundleAsNum, Thingies } from "@/lib/game/njs/Thingies";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { TalentCalc } from "@/lib/game/njs/TalentCalc";

const vault = (c: Ctx, n: number) => Summoning(c, "VaultUpgBonus", n, 0);
const kills = (c: Ctx, n: number) => Summoning(c, "VaultKillzTotal", n, 0);
/** A Cash bubble's term of the first group @4047005: DNSM.AlchBubbles[key] x floor(TotalStats(stat) / 250). */
const cashBubble = (c: Ctx, key: string, stat: string) => DNSM_AlchBubbles(c, key) * Math.floor(TotalStats(c, stat) / 250);

/** The lib/game term of each source, as ArbitraryCode("MonsterCash") uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  bubbleSTR: (c) => cashBubble(c, "CashSTR", "STR"),
  bubbleAGI: (c) => cashBubble(c, "CashAGI", "AGI"),
  bubbleWIS: (c) => cashBubble(c, "CashWIS", "WIS"),
  comp24: (c) => Companions(c, 24),
  comp38: (c) => Stuff2(c, "CoinDropMulti", 0, 0) - 1,
  comp45: (c) => Companions(c, 45),
  comp159: (c) => Companions(c, 159),
  eventShop9: (c) => 0.5 * Summoning(c, "EventShopOwned", 9, 0),
  eventShop20: (c) => 0.6 * Summoning(c, "EventShopOwned", 20, 0),
  etc77: (c) => EtcBonuses(c, "77"),
  sushi18: (c) => SushiStuff(c, "RoG_BonusQTY", 18, 0),
  sushi37: (c) => SushiStuff(c, "RoG_BonusQTY", 37, 0),
  grid149: (c) => ResearchStuff(c, "Grid_Bonus", 149, 0),
  grid169: (c) => ResearchStuff(c, "Grid_Bonus", 169, 0),
  etc100: (c) => EtcBonuses(c, "100"),
  goldSet: (c) => GetSetBonus(c, "GOLD_SET", "Bonus", 0, 0),
  gambit7: (c) => Holes(c, "GambitBonuses", 7, 0),
  bunY: (c) => 250 * bundleAsNum(c, "bun_y"),
  dustWalker: (c) => Math.max(1, getbonus2(c, 1, 433, -1)) * getLOG(c, asNum(c, "OptionsListAccount", 362)),
  mealCash: (c) => MealBonus(c, "Cash"),
  artifact1: (c) => Sailing(c, "ArtifactBonus", 1, 0),
  roo6: (c) => Summoning(c, "RooBonuses", 6, 0),
  vote34: (c) => Summoning(c, "VotingBonusz", 34, 0),
  arena5: (c) => 0.5 * Breeding(c, "PetArenaBonus", "0", 5, 0),
  friend5: (c) => Thingies(c, "FriendBonusStatz", 5, 0),
  arena14: (c) => Breeding(c, "PetArenaBonus", "0", 14, 0),
  statue19: (c) => ArbitraryCode(c, "StatueBonusGiven19") / 100,
  mainframe9: (c) => MainframeBonus(c, 9),
  vault34: (c) => vault(c, 34) * kills(c, 8),
  vault37: (c) => vault(c, 37) * kills(c, 9),
  pristine16: (c) => Ninja(c, "PristineBon", 16, 0),
  prayer8: (c) => prayersReal(c, 8, 0),
  divMinor3: (c) => Divinity(c, "Bonus_Minor", -1, 3),
  cropSC4: (c) => FarmingStuffs(c, "CropSCbonus", 4, 0),
  talent657: (c) => GetTalentNumber(c, 1, 657),
  vialCash: (c) => DNSM_AlchVials(c, "MonsterCash"),
  etc3: (c) => EtcBonuses(c, "3"),
  card11: (c) => CardBonusREAL(c, 11),
  cardW5b1: (c) => 7 * RunCodeOfTypeXforThingY(c, "CardLv", "w5b1"),
  talent22: (c) => GetTalentNumber(c, 1, 22),
  flurbo4: (c) => FlurboShop(c, 4),
  arcade10: (c) => ArcadeBonus(c, 10),
  arcade11: (c) => ArcadeBonus(c, 11),
  box13c: (c) => DNSM_BoxRewards(c, "13c"),
  guild8: (c) => GuildBonuses(c, 8) * (1 + Math.floor(c.map / 50)),
  talent643: (c) => TalentCalc(c, 643),
  talent644: (c) => TalentCalc(c, 644),
  goldFood: (c) => GoldFoodBonuses(c, "MonsterCash"),
  vault17: (c) => vault(c, 17) * getLOG(c, asNum(c, "OptionsListAccount", 340)),
  ach235: (c) => 5 * AchieveStatus(c, 235),
  ach350: (c) => 10 * AchieveStatus(c, 350),
  ach376: (c) => 20 * AchieveStatus(c, 376),
  vault2: (c) => vault(c, 2),
  vault14: (c) => vault(c, 14) * kills(c, 4),
  vault31: (c) => vault(c, 31) * kills(c, 7),
  ola420: (c) => asNum(c, "OptionsListAccount", 420),
  vault70: (c) => vault(c, 70) * Stuff2(c, "CardsCollected", 0, 0),
};

describe("the Coin term table covers every source of the page's descriptor", () => {
  it("has one term per COIN_GROUPS source, no more", () => {
    expect(Object.keys(TERMS).sort()).toEqual(COIN_GROUPS.flatMap((g) => g.sources).sort());
  });
});
