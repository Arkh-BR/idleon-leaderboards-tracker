// Task 3 (AFK plan): the edges of AFKgainrates("Fighting") (N.js @4443869) and afkFightRate on a synthetic envelope (no real save, so CI runs
// them): the rate (.4 + Σ/100) x M, the merit and the bun_u bundle in the ALL terms, the .01 floor, the Clamworks' x0.2 on map 306, the Cove
// on map 216 in cavern 17 (replacing everything), and the page's 0 for a map with nothing to fight. Every block AFKgainrates calls is answered
// from the Ctx cache (`seed`), so only the block's own arithmetic and its map rules are under test.
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { MapAFKtarget } from "@/lib/game/data";
import { NotPorted } from "@/lib/game/errors";
import { AFKgainrates, afkFightRate } from "@/lib/game/njs/AFKgainrates";

type Data = Record<string, unknown>;
type Seeds = Record<string, number>;

/** Every call AFKgainrates("Fighting") makes, as the Ctx cache keys it (`name + JSON.stringify(args)`), all 0. */
const CALLS = [
  'ArcadeBonus[6]', 'Windwalker["CompassBonus",57,0]', 'GetSetBonus["VOID_SET","Bonus",0,0]', "FlurboShop[7]", 'Divinity["Bonus_MAJOR",0,0]',
  'Divinity["Bonus_Minor",-1,5]', "Companions[6]", "Companions[25]", "Shrine[8]", "TalentCalc[650]", 'Summoning["WinBonus",11,0]',
  'GoldFoodBonuses["AllAFK"]', 'RunCodeOfTypeXforThingY["CardLv","w6d3"]', 'RunCodeOfTypeXforThingY["CardLv","w6d1"]', 'Summoning["RooBonuses",5,0]',
  'Summoning["VotingBonusz",6,0]', 'Summoning["EventShopOwned",5,0]', 'Summoning["VaultUpgBonus",23,0]', 'ArcaneType["ArcaneMapMulti_bon",2,0]',
  'EtcBonuses["92"]', 'EtcBonuses["20"]', 'EtcBonuses["59"]', 'DNSM.FamBonusQTYs["8"]', 'DNSM.BoxRewards["fightAFK"]', "GetTalentNumber[1,88]",
  "GetTalentNumber[1,268]", "GetTalentNumber[1,448]", "GetTalentNumber[1,621]", "GetTalentNumber[1,79]", 'GetBribeBonus["3"]', 'CardSetBonuses[0,"10"]',
  "CardBonusREAL[43]", 'DNSM.StarSigns["FightAFK"]', "GuildBonuses[4]", "prayersReal[4,0]", "prayersReal[12,1]", 'chipBonuses["fafk"]',
  'Holes2["Cglunko_AFKgains",0,0]',
];

/** A character 0 on map `map` (`CurrentMap_0`: `at`, default -1: never the map under test, so its saved AFK target is not kept), with `seeds` over all-0 calls. */
function synth(data: Data, o: { map?: number; at?: number; seeds?: Seeds } = {}): Ctx {
  const map = o.map ?? 251;
  const c = makeCtx(
    buildGameState({
      data: { CurrentMap_0: o.at ?? -1, AFKtarget_0: "Mush", TaskZZ2: [[], [0, 0, 0]], ...data },
      charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map }
  );
  for (const k of CALLS) c.cache.set(`0|${map}|${k}`, 0);
  for (const [k, v] of Object.entries(o.seeds ?? {})) {
    expect(CALLS, `${k} is a call AFKgainrates makes`).toContain(k);
    c.cache.set(`0|${map}|${k}`, v);
  }
  return c;
}
const rate = (data: Data, o?: Parameters<typeof synth>[1]) => AFKgainrates(synth(data, o), "Fighting");
const cavern = (n: number) => ({ Holes: [[n]] });

describe("AFKgainrates(\"Fighting\") (synthetic, runs in CI)", () => {
  it("is .4 with nothing, (.4 + Σ/100) with fight terms, and the Σ terms add in percent", () => {
    expect(rate({})).toBe(0.4);
    expect(rate({}, { seeds: { 'DNSM.FamBonusQTYs["8"]': 60 } })).toBeCloseTo(1, 12);
    expect(rate({}, { seeds: { "GetTalentNumber[1,88]": 10, "GetTalentNumber[1,79]": 20, 'chipBonuses["fafk"]': 30 } })).toBeCloseTo(1, 12);
  });

  it("the ALL terms: 2 from the W2 merit (Tasks[2][1][2] past the character's index), 30 from bun_u, and the ALL list", () => {
    expect(rate({ TaskZZ2: [[], [0, 0, 1]] })).toBeCloseTo(0.42, 12); // 1 > 0
    expect(rate({ TaskZZ2: [[], [0, 0, 0]] })).toBe(0.4); // 0 > 0 is false
    expect(rate({ BundlesReceived: { bun_u: 1 } })).toBeCloseTo(0.7, 12);
    expect(rate({ BundlesReceived: { bun_u: 0 } })).toBe(0.4);
    // the whole ALL list, each term in its own weight
    const seeds: Seeds = { "ArcadeBonus[6]": 1, "FlurboShop[7]": 2, "Companions[6]": 3, "Shrine[8]": 4, "TalentCalc[650]": 5, 'Summoning["WinBonus",11,0]': 6, 'Summoning["EventShopOwned",5,0]': 1 };
    expect(rate({}, { seeds })).toBeCloseTo(0.4 + (1 + 2 + 3 + 4 + 5 + 6 + 20) / 100, 12);
    expect(rate({}, { seeds: { 'RunCodeOfTypeXforThingY["CardLv","w6d3"]': 10 } })).toBeCloseTo(0.4 + 0.15, 12); // 1.5 x
    expect(rate({}, { seeds: { 'RunCodeOfTypeXforThingY["CardLv","w6d1"]': 10 } })).toBeCloseTo(0.4 + 0.1, 12); // x1, in the Fighting sum
  });

  it("a negative Σ (the Ruck Sack curse) is the curse subtracted", () => {
    expect(rate({}, { seeds: { "prayersReal[4,0]": 50, "prayersReal[12,1]": 20 } })).toBeCloseTo(0.4 + 0.3, 12);
  });

  it("the multipliers: (1 + arcane / 100) x (1 + EtcBonuses(92) / 100) on the whole rate", () => {
    expect(rate({}, { seeds: { 'ArcaneType["ArcaneMapMulti_bon",2,0]': 100, 'EtcBonuses["92"]': 50 } })).toBeCloseTo(0.4 * 2 * 1.5, 12);
    expect(rate({}, { seeds: { 'DNSM.FamBonusQTYs["8"]': 60, 'EtcBonuses["92"]': 100 } })).toBeCloseTo(2, 12);
  });

  it("never below .01, whatever the sign of Σ", () => {
    expect(rate({}, { seeds: { "prayersReal[12,1]": 100 } })).toBe(0.01);
    expect(rate({}, { seeds: { "prayersReal[12,1]": 100 }, map: 306 })).toBe(0.01);
    expect(rate(cavern(17), { seeds: { "prayersReal[12,1]": 100, 'Holes2["Cglunko_AFKgains",0,0]': 0 }, map: 216 })).toBe(0.01); // the Cove's rate, floored
    expect(rate(cavern(16), { seeds: { "prayersReal[12,1]": 100 }, map: 216 })).toBe(0.01);
    expect(rate({}, { seeds: { "prayersReal[12,1]": 40 } })).toBe(0.01); // .4 - .4 = 0
  });

  it("map 306 (the Clamworks) takes a fifth, the multipliers included; any other map takes none", () => {
    const seeds: Seeds = { 'DNSM.FamBonusQTYs["8"]': 60, 'EtcBonuses["92"]': 50 };
    expect(rate({}, { seeds, map: 251 })).toBeCloseTo(1.5, 12);
    expect(rate({}, { seeds, map: 306 })).toBeCloseTo(0.3, 12);
    expect(rate({}, { seeds, map: 305 })).toBeCloseTo(1.5, 12);
  });

  it("map 216 in cavern 17 is the Cove's rate, replacing the sum and the multipliers; with bun_u it is x1.3", () => {
    const seeds: Seeds = { 'Holes2["Cglunko_AFKgains",0,0]': 0.5, 'DNSM.FamBonusQTYs["8"]': 9999, 'EtcBonuses["92"]': 100 };
    expect(rate(cavern(17), { seeds, map: 216 })).toBe(0.5);
    expect(rate({ ...cavern(17), BundlesReceived: { bun_u: 1 } }, { seeds, map: 216 })).toBeCloseTo(0.65, 12);
    // another cavern, or the right cavern on another map, is the plain rate
    expect(rate(cavern(16), { seeds, map: 216 })).toBeCloseTo((0.4 + 99.99) * 2, 9);
    expect(rate(cavern(17), { seeds, map: 251 })).toBeCloseTo((0.4 + 99.99) * 2, 9);
    // the cavern is read only on map 216: no Holes in the save is fine elsewhere
    expect(rate({}, { seeds, map: 251 })).toBeCloseTo((0.4 + 99.99) * 2, 9);
  });

  it("a sub-case other than Fighting is not ported", () => {
    for (const d of ["Mining", "Choppin", "Fishing", "Catching", "Cooking", "Research", "Bogus"]) expect(() => AFKgainrates(synth({}), d), d).toThrow(NotPorted);
  });
});

describe("afkFightRate: 0 when the map's AFK target has nothing to fight (synthetic, runs in CI)", () => {
  const seeds: Seeds = { 'DNSM.FamBonusQTYs["8"]': 60 }; // the Fighting rate is 1
  const fightMap = 251; // default target w6a1 (a monster)
  const target = (m: number) => (MapAFKtarget as unknown as string[])[m];

  it("a map whose default target is a monster gives the rate", () => {
    expect(target(fightMap)).toBe("w6a1");
    expect(afkFightRate(synth({}, { seeds, map: fightMap }))).toBeCloseTo(1, 12);
  });

  it("a target of type Nothing (map 0) and a target with no definition (map 33, 'Z') give 0, and never throw", () => {
    expect(target(0)).toBe("Nothing");
    expect(target(33)).toBe("Z");
    expect(afkFightRate(synth({}, { seeds, map: 0 }))).toBe(0);
    expect(afkFightRate(synth({}, { seeds, map: 33 }))).toBe(0);
  });

  it("a skill target (map 6, mining) shows the Fighting rate, as lib/arkh's page does", () => {
    expect(afkFightRate(synth({}, { seeds, map: 6 }))).toBeCloseTo(1, 12);
  });

  it("on the map the character stands on its saved target is kept (Ruling V): Nothing there is 0, a monster is the rate", () => {
    expect(afkFightRate(synth({ AFKtarget_0: "Nothing", CurrentMap_0: fightMap }, { seeds, map: fightMap }))).toBe(0);
    expect(afkFightRate(synth({ AFKtarget_0: target(1), CurrentMap_0: 0 }, { seeds, map: 0 }))).toBeCloseTo(1, 12); // map 0's default is Nothing
    // on another map the saved target says nothing
    expect(afkFightRate(synth({ AFKtarget_0: "Nothing", CurrentMap_0: 5 }, { seeds, map: fightMap }))).toBeCloseTo(1, 12);
  });

  it("the Cove (map 216, cavern 17) counts as a fight whatever its target says; map 216 outside the Cove has nothing to fight", () => {
    expect(target(216)).toBe("Nothing");
    const cove: Seeds = { ...seeds, 'Holes2["Cglunko_AFKgains",0,0]': 0.5 };
    expect(afkFightRate(synth(cavern(17), { seeds: cove, map: 216 }))).toBe(0.5);
    expect(afkFightRate(synth(cavern(16), { seeds: cove, map: 216 }))).toBe(0);
  });
});
