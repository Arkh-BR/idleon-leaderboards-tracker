// Task 3 (Coin plan): the edges of ArbitraryCode("MonsterCash") (N.js @4047005 raw) on a synthetic envelope (no real save, so CI runs them): every
// factor and every term of the additive pool alone, at a value of its own, so a swapped key or a wrong multiplier fails; the Cash bubbles' floor; the
// min(4, ·) companions at 3.9, 4 and 4.1; the guild term of ctx.map at 49/50, 299/300 and past the last world; TalentCalc(643) under and over map 300, at the tier ceiling and
// on a map whose target has no monster. Every block the sub-case calls answers 0 unless the test seeds it (expStub's ZeroCache); `real` lists the blocks
// left to their code.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { njsFunction, njsNamedBlocks } from "@/lib/diagnose/njsCalls";
import { MONSTERS } from "@/lib/game/data";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { loadNjs } from "@/scripts/njs-calls";
import { type Data, type Seeds, synth } from "../support/expStub";

const REAL = ['ArbitraryCode["MonsterCash"]'];
const COIN_DROP = 'Stuff2["CoinDropMulti",0,0]'; // the only factor with no `1 +`: the stub's 0 would zero the product
type Opts = { map?: number; real?: string[] };
const cash = (data: Data = {}, seeds: Seeds = {}, o: Opts = {}) =>
  ArbitraryCode(synth(data, { map: o.map, seeds: { [COIN_DROP]: 1, ...seeds }, real: [...REAL, ...(o.real ?? [])] }), "MonsterCash");
const ola = (at: Record<number, number>) => ({ OptLacc: Object.assign(Array<number>(700).fill(0), at) });
const close = (got: number, want: number) => expect(got / want).toBeCloseTo(1, 12);

describe("the base", () => {
  it("with every block 0 the total is 1, and Stuff2 CoinDropMulti multiplies it as it is (a 0 zeroes the total)", () => {
    expect(cash()).toBe(1);
    expect(cash({}, { [COIN_DROP]: 0 })).toBe(0);
  });
});

describe("the Cash bubbles: 1 + Σ DNSM.AlchBubbles[Cash<stat>] x floor(TotalStats(<stat>) / 250) / 100", () => {
  const bubble = (s: string) => `DNSM.AlchBubbles["Cash${s}"]`;
  const stat = (s: string) => `TotalStats["${s}"]`;
  it.each([["STR", 3], ["AGI", 5], ["WIS", 7]] as const)("%s (bubble %s): the floor steps at 250 and 500", (s, b) => {
    const at = (v: number) => cash({}, { [bubble(s)]: b, [stat(s)]: v });
    expect(at(249)).toBe(1);
    close(at(250), 1 + b / 100);
    close(at(499), 1 + b / 100);
    close(at(500), 1 + (2 * b) / 100);
  });
  it("a bubble reads its own stat only", () => {
    expect(cash({}, { [bubble("STR")]: 3, [stat("AGI")]: 2500, [stat("WIS")]: 2500 })).toBe(1);
    expect(cash({}, { [bubble("AGI")]: 5, [stat("STR")]: 2500, [stat("WIS")]: 2500 })).toBe(1);
    expect(cash({}, { [bubble("WIS")]: 7, [stat("STR")]: 2500, [stat("AGI")]: 2500 })).toBe(1);
  });
  it("the three add inside one factor", () => {
    const all = { [bubble("STR")]: 3, [stat("STR")]: 500, [bubble("AGI")]: 5, [stat("AGI")]: 750, [bubble("WIS")]: 7, [stat("WIS")]: 1000 };
    close(cash({}, all), 1 + (3 * 2 + 5 * 3 + 7 * 4) / 100);
  });
});

describe("the min(4, ·) companions", () => {
  it.each([24, 45, 159])("Companions(%s) at 3.9, 4 and 4.1", (id) => {
    const at = (v: number) => cash({}, { [`Companions[${id}]`]: v });
    close(at(3.9), 4.9);
    expect(at(4)).toBe(5);
    expect(at(4.1)).toBe(5);
  });
});

/** Each factor alone, at a value of its own: the seeded key must be the one read, with its multiplier. */
const FACTORS: [string, number, number][] = [
  [COIN_DROP, 2.5, 2.5],
  ["Companions[24]", 0.5, 1.5],
  ["Companions[45]", 0.25, 1.25],
  ["Companions[159]", 0.75, 1.75],
  ['Summoning["EventShopOwned",9,0]', 5, 3.5], // 1 + .5 x 5
  ['Summoning["EventShopOwned",20,0]', 2, 2.2], // 1 + .6 x 2
  ['EtcBonuses["77"]', 10, 1.1],
  ['SushiStuff["RoG_BonusQTY",18,0]', 20, 1.2],
  ['SushiStuff["RoG_BonusQTY",37,0]', 30, 1.3],
  ['ResearchStuff["Grid_Bonus",149,0]', 40, 1.4],
  ['ResearchStuff["Grid_Bonus",169,0]', 45, 1.45],
  ['EtcBonuses["100"]', 50, 1.5],
  ['GetSetBonus["GOLD_SET","Bonus",0,0]', 60, 1.6],
  ['Holes["GambitBonuses",7,0]', 70, 1.7],
  ['MealBonus["Cash"]', 5, 1.05],
  ['Sailing["ArtifactBonus",1,0]', 15, 1.15],
  ['Summoning["RooBonuses",6,0]', 35, 1.35],
  ['Summoning["VotingBonusz",34,0]', 65, 1.65],
  ['Breeding["PetArenaBonus","0",5,0]', 2.2, 2.1], // 1 + .5 x 2.2
  ['Thingies["FriendBonusStatz",5,0]', 0.55, 1.55],
  ['Breeding["PetArenaBonus","0",14,0]', 1.95, 2.95],
  ['ArbitraryCode["StatueBonusGiven19"]', 85, 1.85], // the statue alone is / 100 in this raw factor
  ["MainframeBonus[9]", 12, 1.12],
  ['Ninja["PristineBon",16,0]', 80, 1.8],
  ["prayersReal[8,0]", 90, 1.9],
  ['Divinity["Bonus_Minor",-1,3]', 11, 1.11],
  ['FarmingStuffs["CropSCbonus",4,0]', 13, 1.13],
];
/** The terms of the last factor, 1 + Σ / 100, alone: [key, seed, its points]. */
const POOL: [string, number, number][] = [
  ["GetTalentNumber[1,657]", 1.5, 1.5],
  ['DNSM.AlchVials["MonsterCash"]', 2.5, 2.5],
  ['EtcBonuses["3"]', 3.5, 3.5],
  ["CardBonusREAL[11]", 4.5, 4.5],
  ['RunCodeOfTypeXforThingY["CardLv","w5b1"]', 3, 21], // 7 x
  ["GetTalentNumber[1,22]", 5.5, 5.5],
  ["FlurboShop[4]", 6.5, 6.5],
  ["ArcadeBonus[10]", 7.5, 7.5],
  ["ArcadeBonus[11]", 8.5, 8.5],
  ['DNSM.BoxRewards["13c"]', 9.5, 9.5],
  ["TalentCalc[643]", 10.5, 10.5],
  ["TalentCalc[644]", 11.5, 11.5],
  ['GoldFoodBonuses["MonsterCash"]', 12.5, 12.5],
  ["AchieveStatus[235]", 1, 5], // 5 x
  ["AchieveStatus[350]", 1.5, 15], // 10 x
  ["AchieveStatus[376]", 2, 40], // 20 x
  ['Summoning["VaultUpgBonus",2,0]', 13.5, 13.5],
];
/** a x b, in a factor or the pool: [a's key, a, b's key, b, the total]. */
const PRODUCTS: [string, number, string, number, number][] = [
  ['Summoning["VaultUpgBonus",34,0]', 2, 'Summoning["VaultKillzTotal",8,0]', 7, 1.14],
  ['Summoning["VaultUpgBonus",37,0]', 3, 'Summoning["VaultKillzTotal",9,0]', 11, 1.33],
  ['Summoning["VaultUpgBonus",14,0]', 5, 'Summoning["VaultKillzTotal",4,0]', 13, 1.65],
  ['Summoning["VaultUpgBonus",31,0]', 7, 'Summoning["VaultKillzTotal",7,0]', 17, 2.19],
  ['Summoning["VaultUpgBonus",70,0]', 11, 'Stuff2["CardsCollected",0,0]', 19, 3.09],
];

describe("every factor alone", () => {
  it.each(FACTORS)("%s at %s gives %s", (key, seed, factor) => close(cash({}, { [key]: seed }), factor));
  it.each(PRODUCTS)("%s = %s x %s = %s gives %s, and neither alone moves it", (a, x, b, y, total) => {
    close(cash({}, { [a]: x, [b]: y }), total);
    expect(cash({}, { [a]: x })).toBe(1);
    expect(cash({}, { [b]: y })).toBe(1);
  });
  it("the Cash bundle is 1 + 250 x asNumber(bun_y) / 100; an absent one (or an absent BundlesReceived) leaves it at 1", () => {
    expect(cash({ BundlesReceived: { bun_y: 1 } })).toBe(3.5);
    expect(cash({ BundlesReceived: { bun_y: "2" } })).toBe(6);
    expect(cash({ BundlesReceived: {} })).toBe(1);
    expect(cash({ BundlesReceived: undefined })).toBe(1);
  });
  it("Dustwalker is 1 + max(1, getbonus2(1, 433, -1)) x getLOG(OptionsListAccount[362]) / 100", () => {
    const log = { "getLOG[362]": 20 };
    close(cash(ola({ 362: 362 }), { ...log, "getbonus2[1,433,-1]": 3 }), 1.6);
    close(cash(ola({ 362: 362 }), { ...log, "getbonus2[1,433,-1]": 0.5 }), 1.2); // under 1 it counts as 1
    close(cash(ola({ 362: 362 }), log), 1.2);
    expect(cash(ola({ 340: 362 }), log)).toBe(1); // OptionsListAccount[340] is the Vault's, not this one
  });
  it("the terms of one factor add", () => {
    close(cash({}, { 'ResearchStuff["Grid_Bonus",149,0]': 40, 'ResearchStuff["Grid_Bonus",169,0]': 45 }), 1.85);
    close(cash({}, { 'MealBonus["Cash"]': 5, 'Sailing["ArtifactBonus",1,0]': 15, 'Summoning["RooBonuses",6,0]': 35, 'Summoning["VotingBonusz",34,0]': 65 }), 2.2);
    close(cash({}, { 'Breeding["PetArenaBonus","0",5,0]': 2.2, 'Thingies["FriendBonusStatz",5,0]': 0.55, 'Breeding["PetArenaBonus","0",14,0]': 1.95, 'ArbitraryCode["StatueBonusGiven19"]': 85 }), 1 + (1.1 + 0.55 + 1.95 + 0.85));
    close(cash({}, { "MainframeBonus[9]": 12, 'Summoning["VaultUpgBonus",34,0]': 2, 'Summoning["VaultKillzTotal",8,0]': 7, 'Summoning["VaultUpgBonus",37,0]': 3, 'Summoning["VaultKillzTotal",9,0]': 11 }), 1 + (12 + 14 + 33) / 100);
    close(cash({}, { 'Divinity["Bonus_Minor",-1,3]': 11, 'FarmingStuffs["CropSCbonus",4,0]': 13 }), 1.24);
  });
});

describe("the additive pool: one factor, 1 + Σ / 100", () => {
  it.each(POOL)("%s at %s is %s points", (key, seed, points) => close(cash({}, { [key]: seed }), 1 + points / 100));
  it("the Vault's upgrade 17 is x getLOG(OptionsListAccount[340]), OptionsListAccount[420] counts as it is", () => {
    close(cash(ola({ 340: 340 }), { 'Summoning["VaultUpgBonus",17,0]': 4, "getLOG[340]": 6 }), 1.24);
    expect(cash(ola({ 341: 340 }), { 'Summoning["VaultUpgBonus",17,0]': 4, "getLOG[340]": 6 })).toBe(1);
    close(cash(ola({ 420: 14.5 })), 1.145);
  });
  it("its terms add, they do not multiply", () => {
    close(cash({}, { "GetTalentNumber[1,657]": 10, "ArcadeBonus[10]": 20, "AchieveStatus[376]": 1 }), 1 + (10 + 20 + 20) / 100);
  });
});

describe("every factor at once", () => {
  it("is the product of the factors, the pool summed (each key read once, none twice)", () => {
    const seeds: Seeds = Object.fromEntries([...FACTORS, ...POOL].map(([k, v]) => [k, v]));
    for (const [a, x, b, y] of PRODUCTS) Object.assign(seeds, { [a]: x, [b]: y });
    Object.assign(seeds, { 'DNSM.AlchBubbles["CashSTR"]': 3, 'TotalStats["STR"]': 500, "getbonus2[1,433,-1]": 3, "getLOG[362]": 20, "getLOG[340]": 6, 'Summoning["VaultUpgBonus",17,0]': 4, "GuildBonuses[8]": 2 });
    const data = { ...ola({ 362: 362, 340: 340, 420: 14.5 }), BundlesReceived: { bun_y: 1 } };
    // the pool: its table, the three Vault x kills products, the Vault 17 x its log, OLA[420], the guild on map 251 (x 6)
    const pool = POOL.reduce((s, [, , p]) => s + p, 0) + 5 * 13 + 7 * 17 + 11 * 19 + 4 * 6 + 14.5 + 2 * 6;
    const want =
      (1 + (3 * 2) / 100) * 1.5 * 2.5 * 1.25 * 1.75 * 3.5 * 2.2 * 1.1 * 1.2 * 1.3 * 1.85 * 1.5 * 1.6 * 1.7 * 3.5 * 1.6 * (1 + (5 + 15 + 35 + 65) / 100) *
      (1 + (1.1 + 0.55 + 1.95 + 0.85)) * (1 + (12 + 14 + 33) / 100) * 1.8 * 1.9 * 1.24 * (1 + pool / 100);
    close(cash(data, seeds), want);
  });
});

describe("the guild term: GuildBonuses(8) x (1 + floor(ctx.map / 50)), in the pool", () => {
  it.each([
    [49, 1.02],
    [50, 1.04],
    [299, 1.12],
    [300, 1.14],
    [350, 1.16], // past the last world (MapName ends at 326): the floor has no cap
  ])("map %s gives %s", (map, total) => close(cash({}, { "GuildBonuses[8]": 2 }, { map }), total));
});

describe("TalentCalc(643) in the pool: talent 643 x the multikill tier on ctx.map's target (E = 2 under map 300, 5 from it)", () => {
  const TIER = ["TalentCalc[643]", 'RunCodeOfTypeXforThingY["OverkillStuffs"'];
  const tgt = "mushG";
  const hp = Number((MONSTERS as unknown as Record<string, { MonsterHPTotal: unknown }>)[tgt].MonsterHPTotal);
  const at = (map: number, max: number) => cash({ CurrentMap_0: map, AFKtarget_0: tgt }, { "GetTalentNumber[1,643]": 3, 'DamageDealed["Max"]': max }, { map, real: TIER });
  it("under map 300: tier 1 below HP x 2^2, tier 2 from it", () => {
    close(at(299, hp * 4 - 1), 1.03);
    close(at(299, hp * 4), 1.06);
  });
  it("from map 300: the same damage is tier 1, tier 2 takes HP x 5^2", () => {
    close(at(300, hp * 4), 1.03);
    close(at(300, hp * 25), 1.06);
  });
  it("the tier stops at 51", () => {
    close(at(299, Number.MAX_VALUE), 1 + (3 * 51) / 100);
  });
  it("on a map whose target has no monster the game throws, so the block refuses", () => {
    expect(() => cash({}, { 'DamageDealed["Max"]': 1e9, "GetTalentNumber[1,643]": 3 }, { map: 33, real: TIER })).toThrow('AFKtarget: expected a MonsterDefinitions key, got string "Z"');
  });
});

// The port is the game's text with the calls spelled the way lib/game spells them: same factors, same order, same parentheses, so the floats are the game's.
describe("the expression", () => {
  it.skipIf(!existsSync("scripts/updater/.cache/N.new.js"))("is N.js's token for token (calls and reads spelled as lib/game spells them)", () => {
    const njs = njsNamedBlocks(njsFunction(loadNjs(), "ArbitraryCode")!.body, "MonsterCash")[0]
      .replace(/^return/, "")
      .replace(/;$/, "")
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("DNSM"\)\.h\.AlchBubbles\.h\.(\w+)\)/g, 'DNSM_AlchBubbles(ctx,"$1")')
      .replace('c.asNumber(a.engine.getGameAttribute("DNSM").h.AlchVials.h.MonsterCash)', 'DNSM_AlchVials(ctx,"MonsterCash")')
      .replace('c.asNumber(a.engine.getGameAttribute("DNSM").h.BoxRewards.h["13c"])', 'DNSM_BoxRewards(ctx,"13c")')
      .replace('c.asNumber(a.engine.getGameAttribute("BundlesReceived").h.bun_y)', 'bundleAsNum(ctx,"bun_y")')
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("OptionsListAccount"\)\[(\d+)\]\)/g, 'asNum(ctx,"OptionsListAccount",$1)')
      .replace('a.engine.getGameAttribute("CurrentMap")', "ctx.map")
      .replace(/\b\w\._customBlock_(\w+)\(/g, "$1(ctx,")
      .replace(/(?<![\w.])\.(\d)/g, "0.$1");
    const src = readFileSync("lib/game/njs/ArbitraryCode.ts", "utf8").replace(/\r/g, "");
    const body = src.slice(src.indexOf('case "MonsterCash":'));
    const port = body.slice(body.indexOf("return (") + "return (".length, body.indexOf("\n      );"));
    expect(port.replace(/\s+/g, "")).toBe(njs.replace(/\s+/g, ""));
  }, 120_000);
});
