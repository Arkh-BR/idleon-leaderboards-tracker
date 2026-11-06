// Task 3 (AFK plan): the edges of AFKgainrates("Fighting") (N.js @4443869) and afkFightRate on a synthetic envelope (no real save, so CI runs
// them): the rate (.4 + Σ/100) x M, the merit and the bun_u bundle in the ALL terms, the .01 floor, the Clamworks' x0.2 on map 306, the Cove
// on map 216 in cavern 17 (replacing everything), and the page's 0 for a map with nothing to fight. Every block AFKgainrates calls is answered
// from the Ctx cache (support/afkStub), so only the block's own arithmetic and its map rules are under test.
import { describe, it, expect } from "vitest";
import { MapAFKtarget } from "@/lib/game/data";
import { NotPorted } from "@/lib/game/errors";
import { AFKgainrates } from "@/lib/game/njs/AFKgainrates";
import { afkFightRate } from "@/lib/game/trackers/afkGains";
import { synth, type Seeds } from "../support/afkStub";

const rate = (data: Record<string, unknown>, o?: Parameters<typeof synth>[1]) => AFKgainrates(synth(data, o), "Fighting");
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

  // Carried minor (Task 3 review): N.js's parentheses decide the float rounding (the panel shows floor(100 x rate)). These seeds give
  // 1.2665864999999998 / 1.217 with N.js's nesting and 1.2665865 / 1.2169999999999999 summed flat; the expected values were evaluated
  // from N.js's text, not from the port.
  it("the ALL list and the Fighting sum add in N.js's parenthesis nesting (float-exact)", () => {
    const all: Seeds = {
      "ArcadeBonus[6]": 1.6539, 'Windwalker["CompassBonus",57,0]': 2.0313, 'GetSetBonus["VOID_SET","Bonus",0,0]': 0.7992, "FlurboShop[7]": 2.75,
      'Divinity["Bonus_MAJOR",0,0]': 0.14, 'Divinity["Bonus_Minor",-1,5]': 6.95, "Companions[6]": 0.25529999999999997, "Companions[25]": 1.52,
      "Shrine[8]": 1.7908, "TalentCalc[650]": 4.16, 'Summoning["WinBonus",11,0]': 0.5476, 'GoldFoodBonuses["AllAFK"]': 3.59,
      'RunCodeOfTypeXforThingY["CardLv","w6d3"]': 3.4817, 'Summoning["RooBonuses",5,0]': 9.03, 'Summoning["VotingBonusz",6,0]': 0.8140000000000001,
      'Summoning["EventShopOwned",5,0]': 1.7057, 'Summoning["VaultUpgBonus",23,0]': 7.23,
    };
    expect(rate({}, { seeds: all })).toBe(1.2665864999999998);
    const fight: Seeds = {
      'DNSM.FamBonusQTYs["8"]': 3.54, 'DNSM.BoxRewards["fightAFK"]': 4.92, "GetTalentNumber[1,88]": 9.06, 'GetBribeBonus["3"]': 2.45,
      "GetTalentNumber[1,268]": 4.67, 'CardSetBonuses[0,"10"]': 7.31, "GetTalentNumber[1,448]": 4.53, "GetTalentNumber[1,621]": 5.43,
      "CardBonusREAL[43]": 4.05, "GetTalentNumber[1,79]": 4.61, 'EtcBonuses["20"]': 7.86, 'EtcBonuses["59"]': 8.79, 'DNSM.StarSigns["FightAFK"]': 3.36,
      "GuildBonuses[4]": 5.97, "prayersReal[4,0]": 5.13, "prayersReal[12,1]": 6.7, 'chipBonuses["fafk"]': 2.03, 'RunCodeOfTypeXforThingY["CardLv","w6d1"]': 4.69,
    };
    expect(rate({}, { seeds: fight })).toBe(1.217);
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
    // N.js reads Math.min(1, c.asNumber(bun_u)) there, not `1 == bun_u`: a fraction counts as itself, more than 1 as 1, an absent map as 0
    const half = rate({ ...cavern(17), BundlesReceived: { bun_u: 0.5 } }, { seeds, map: 216 });
    expect(half).toBeCloseTo(0.5 * 1.15, 12);
    expect(rate({ ...cavern(17), BundlesReceived: { bun_u: 2 } }, { seeds, map: 216 })).toBeCloseTo(0.65, 12);
    expect(rate({ ...cavern(17), BundlesReceived: {} }, { seeds, map: 216 })).toBe(0.5);
    // while the ALL list's +30 is `1 == bun_u`: 0.5 and 2 are not the bundle
    expect(rate({ BundlesReceived: { bun_u: 0.5 } })).toBe(0.4);
    expect(rate({ BundlesReceived: { bun_u: 2 } })).toBe(0.4);
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

  // Carried minor 4: afkFightRate is page product logic (decision A9), not an N.js block, so it lives with the tracker and says what it decided
  // in the trace: an `assumed:` leaf (a stated stand-in, Ruling J) for the 0 and for the skill target's Fighting rate, none for a plain fight.
  it("leaves an assumed: A9 leaf in the trace: 0 for a target with nothing to fight, 1 for a skill target, none for a fight or the Cove", () => {
    const leaves = (c: ReturnType<typeof synth>) => c.trace!.children.filter((n) => n.block === "AFK target").map((n) => [n.value, n.note]);
    const at = (map: number, data: Record<string, unknown> = {}) => {
      const c = synth(data, { seeds, map, trace: true });
      return { c, rate: afkFightRate(c) };
    };
    let r = at(0);
    expect(r.rate).toBe(0);
    expect(leaves(r.c)).toEqual([[0, "assumed: the AFK target Nothing has nothing to fight: this page shows 0"]]);
    r = at(33);
    expect(leaves(r.c)).toEqual([[0, "assumed: Z has no monster to fight: this page shows 0"]]);
    r = at(6);
    expect(r.rate).toBeCloseTo(1, 12);
    expect(leaves(r.c)).toEqual([[1, `assumed: the AFK target ${target(6)} is a MINING skill, whose own rate the game shows: this page shows the Fighting rate`]]);
    expect(at(fightMap).c.trace!.children.some((n) => n.block === "AFK target")).toBe(false);
    const cove: Seeds = { ...seeds, 'Holes2["Cglunko_AFKgains",0,0]': 0.5 };
    const c = synth(cavern(17), { seeds: cove, map: 216, trace: true });
    expect(afkFightRate(c)).toBe(0.5);
    expect(c.trace!.children.some((n) => n.block === "AFK target")).toBe(false);
  });

  it("the Cove (map 216, cavern 17) counts as a fight whatever its target says; map 216 outside the Cove has nothing to fight", () => {
    expect(target(216)).toBe("Nothing");
    const cove: Seeds = { ...seeds, 'Holes2["Cglunko_AFKgains",0,0]': 0.5 };
    expect(afkFightRate(synth(cavern(17), { seeds: cove, map: 216 }))).toBe(0.5);
    expect(afkFightRate(synth(cavern(16), { seeds: cove, map: 216 }))).toBe(0);
  });
});
