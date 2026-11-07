// Task 2 (DR plan): the edges of the sub-cases this task ported for TotalStats("Drop_Rarity"), on a synthetic envelope (no real save, so CI runs
// them). Only the keys a test sets are in the save; every other block is answered from the Ctx cache (`seed`). Values come from the data tables.
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { NotPorted } from "@/lib/game/errors";
import { DeathNoteMobs, MapAFKtarget, MapDetails, NinjaInfo, RandoListo2 } from "@/lib/game/data";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Summoning } from "@/lib/game/njs/Summoning";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { Thingies } from "@/lib/game/njs/Thingies";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { Minehead } from "@/lib/game/njs/Minehead";

type Data = Record<string, unknown>;
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
const synth = (data: Data, chars = 1): Ctx =>
  makeCtx(
    buildGameState({
      data,
      charNames: Array.from({ length: chars }, (_, i) => `c${i}`),
      companion: null,
      guildData: {},
      serverVars: null,
      tournament: {},
      accountCreateTime: 1,
      lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map: 251 }
  );
const ola = (at: Record<number, unknown>) => Object.assign(Array<unknown>(700).fill(0), at);
const cell = (list: unknown, ...idx: number[]) => Number(idx.reduce<unknown>((v, i) => (v as unknown[])[i], list));
/** Holes with 30 rows of 100 zeros, then the rows `at` gives. */
const holes = (at: Record<number, unknown[]> = {}) => Array.from({ length: 30 }, (_, i) => at[i] ?? Array<number>(100).fill(0));

// ── Summoning TomeBonus
describe("Summoning TomeBonus 2 and 7 (synthetic, runs in CI)", () => {
  const at = (o: { ola197?: unknown; tome?: number; shop27?: number }) => {
    const c = synth({ OptLacc: ola({ 197: o.ola197 ?? 1 }) });
    seed(c, "DNSM.TomeQTYtot", [], o.tome ?? 12345);
    seed(c, "Summoning", ["GrimoireUpgBonus", 17, 0], 10);
    seed(c, "GetSetBonus", ["TROLL_SET", "Bonus", 0, 0], 15);
    seed(c, "Summoning", ["EventShopOwned", 27, 0], o.shop27 ?? 1);
    return c;
  };
  it("2 is 2 x floor(max(0, Tome - 8000) / 100)^.7 x (1 + (Grimoire 17 + TROLL) / 100) while OptionsListAccount[197] is 1 (loosely)", () => {
    expect(Summoning(at({}), "TomeBonus", 2, 0)).toBeCloseTo(2 * Math.pow(43, 0.7) * 1.25, 12);
    expect(Summoning(at({ ola197: "1" }), "TomeBonus", 2, 0)).toBeCloseTo(2 * Math.pow(43, 0.7) * 1.25, 12);
    expect(Summoning(at({ ola197: 0 }), "TomeBonus", 2, 0)).toBe(0);
    expect(Summoning(at({ tome: 7999 }), "TomeBonus", 2, 0)).toBe(0); // below 8000: max(0, ·) is 0
  });
  it("7 is 3 x floor(Tome / 1000)^.3 x the boost once Event Shop item 27 is owned; 1 and 3..5 are not ported", () => {
    expect(Summoning(at({}), "TomeBonus", 7, 0)).toBeCloseTo(3 * Math.pow(12, 0.3) * 1.25, 12);
    expect(Summoning(at({ shop27: 0 }), "TomeBonus", 7, 0)).toBe(0);
    for (const b of [1, 3, 4, 5]) expect(() => Summoning(at({}), "TomeBonus", b, 0), `b=${b}`).toThrow(NotPorted);
  });
});

// ── FarmingStuffs CropSCbonus
describe("FarmingStuffs CropSCbonus 7 (synthetic, runs in CI)", () => {
  const crop = (crops: number, owned: number) => {
    const c = synth({ FarmCrop: Object.fromEntries(Array.from({ length: crops }, (_, i) => [i, 1])) });
    seed(c, "Ninja", ["EmporiumBonus", 38, 0], owned);
    seed(c, "FarmingStuffs", ["CropSCbonMulti", 0, 0], 1.5);
    return FarmingStuffs(c, "CropSCbonus", 7, 0);
  };
  it("is round(max(0, crops - 100)) x the multi once Emporium 38 is owned: 0 up to 100 crops", () => {
    expect(crop(107, 1)).toBe(7 * 1.5);
    expect(crop(100, 1)).toBe(0);
    expect(crop(107, 0)).toBe(0);
    expect(() => FarmingStuffs(synth({ FarmCrop: {} }), "CropSCbonus", 3, 0)).toThrow(NotPorted);
  });
});

// ── Holes measurements, B_UPG 46 and the Death Note
describe("Holes B_UPG 46, the measurements and WorkbenchStuff OverkillQTY (synthetic, runs in CI)", () => {
  it("B_UPG 46 is 5 x Holes[11][26] once bought", () => {
    const at = (bought: number) => Holes(synth({ Holes: holes({ 11: Object.assign(Array<number>(100).fill(0), { 26: 4 }), 13: Object.assign(Array<number>(100).fill(0), { 46: bought }) }) }), "B_UPG", 46, 0);
    expect(at(1)).toBe(20);
    expect(at(0)).toBe(0);
  });
  it("MeasurementBaseBonus: (1 + Cosmo (1, 3) / 100) x v L / (100 + L) for a \"TOT\" value (15: 50TOT), else v x L (1: 2)", () => {
    const c = synth({ Holes: holes({ 22: Object.assign(Array<number>(100).fill(0), { 1: 7, 15: 50 }) }) });
    seed(c, "Holes", ["CosmoBonusQTY", 1, 3], 25);
    expect(Holes(c, "MeasurementBaseBonus", 15, 0)).toBeCloseTo(1.25 * ((50 * 50) / 150), 12);
    expect(Holes(c, "MeasurementBaseBonus", 1, 0)).toBeCloseTo(1.25 * 2 * 7, 12);
  });
  it("MeasurementMulti: 1 + 18 q / 100 below q = 5, 1 + (18 q + 8 (q - 5)) / 100 from it; BonusTOTAL(15) = base(15) x multi(HolesInfo[52][15] = 10)", () => {
    const at = (q: number) => {
      const c = synth({});
      seed(c, "Holes", ["MeasurementQTYfound", 10, 99], q);
      seed(c, "Holes", ["MeasurementBaseBonus", 15, 0], 30);
      return c;
    };
    expect(Holes(at(3), "MeasurementMulti", 10, 0)).toBeCloseTo(1.54, 12);
    expect(Holes(at(7), "MeasurementMulti", 10, 0)).toBeCloseTo(1 + (126 + 16) / 100, 12);
    expect(Holes(at(7), "MeasurementBonusTOTAL", 15, 0)).toBeCloseTo(30 * 2.42, 12);
  });
  it("MeasurementQTYfound: each kind's count, and with e == 99 its scaled value", () => {
    const lv0 = (lv: number, skills: number) => [lv, ...Array<number>(21).fill(skills), -5];
    const c = synth(
      {
        Holes: holes({ 11: Object.assign(Array<number>(100).fill(0), { 28: 1e3, 63: 1e6 }), 26: [3, 4, 5] }),
        FarmCrop: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
        Cards1: ["a", "b", "c"],
        TaskZZ0: [[], [42]],
        Lv0_0: lv0(100, 10),
        Lv0_1: lv0(50, -1),
      },
      2
    );
    seed(c, "DNSM.TomeQTYtot", [], 5e3);
    for (let w = 0; w < 7; w++) seed(c, "WorkbenchStuff", ["OverkillQTY", w, 0], w + 1);
    expect(Holes(c, "MeasurementQTYfound", 0, 99)).toBe(getLOG(c, 1e3));
    expect(Holes(c, "MeasurementQTYfound", 1, 99)).toBe(7 / 14);
    expect(Holes(c, "MeasurementQTYfound", 2, 0)).toBe(150); // every character's Lv0[0]
    expect(Holes(c, "MeasurementQTYfound", 2, 99)).toBe(150 / 500);
    expect(Holes(c, "MeasurementQTYfound", 3, 99)).toBe(5e3 / 2500);
    expect(Holes(c, "MeasurementQTYfound", 4, 0)).toBe(210); // the skill levels Lv0[1..21], each at least 0 (the second character's -1s count 0)
    expect(Holes(c, "MeasurementQTYfound", 5, 99)).toBe(0);
    expect(Holes(c, "MeasurementQTYfound", 6, 99)).toBe(28 / 125);
    expect(Holes(c, "MeasurementQTYfound", 7, 99)).toBe(getLOG(c, 42) / 2);
    expect(Holes(c, "MeasurementQTYfound", 8, 99)).toBe(3 / 150);
    expect(Holes(c, "MeasurementQTYfound", 9, 99)).toBe(12 / 6);
    expect(Holes(c, "MeasurementQTYfound", 10, 0)).toBe(1e6);
    expect(Holes(c, "MeasurementQTYfound", 10, 99)).toBe(Math.max(0, getLOG(c, 1e6) - 2));
    expect(Holes(c, "MeasurementQTYfound", 11, 99)).toBe(0);
  });
  it("OverkillQTY: page w < 7 sums DeathNoteRank of the account's kills on each monster's map; page 7 the minibosses' Ninja[105] kills (table 7842); no page 8", () => {
    const mob = String((DeathNoteMobs as unknown as string[][])[0][0]);
    const m = (MapAFKtarget as unknown as string[]).indexOf(mob);
    const same = (DeathNoteMobs as unknown as string[][])[0].filter((x) => (MapAFKtarget as unknown as string[]).indexOf(x) === m).length;
    // every map with all its portal kills left (no kills), but map m: 20000 kills by character 0 and 10000 by character 1
    const kla = (kills: number) => Array.from({ length: (MapDetails as unknown as unknown[]).length }, (_, i) => [cell(MapDetails, i, 0, 0) - (i === m ? kills : 0)]);
    const minis = (NinjaInfo as unknown as unknown[][])[30].length;
    const ninja = Array.from({ length: 106 }, () => [] as number[]);
    ninja[105] = Array<number>(minis).fill(0);
    ninja[105][0] = 300; // rank 2 in the 7842 table
    const c = synth({ KLA_0: kla(20000), KLA_1: kla(10000), Ninja: ninja, Rift: [0] }, 2);
    expect(WorkbenchStuff(c, "OverkillQTY", 0, 0)).toBe(same); // 30000 kills: rank 1 per monster of page 0 on map m
    expect(WorkbenchStuff(c, "OverkillQTY", 7, 0)).toBe(2);
    expect(() => WorkbenchStuff(c, "OverkillQTY", 8, 0)).toThrow(RangeError);
  });
});

// ── Holes2 Cove
describe("Holes2 Cglunko_DR, Cglunko_Bdig, Cglunko_Pdig (synthetic, runs in CI)", () => {
  it("Bdig and Pdig sum ceil(getLOG) of the six shape counters (1000 is 3: the game's getLOG is a hair under 3)", () => {
    const c = synth({ OptLacc: ola({ 654: 1e3, 655: 0, 656: 5, 657: 1, 660: 99, 665: 101 }) });
    expect(Holes2(c, "Cglunko_Bdig", 0, 0)).toBe(Math.ceil(getLOG(c, 1e3)) + 0 + 1 + 0);
    expect(Holes2(c, "Cglunko_Pdig", 0, 0)).toBe(2 + 3);
  });
  it("Cglunko_DR is the product of the seven upgrade factors, reading OptionsListAccount[668] and [200] through ceil(getLOG)", () => {
    const c = synth({ OptLacc: ola({ 668: 5e4, 200: 300 }) });
    const u: Record<number, number> = { 1: 10, 17: 5, 21: 2, 3: 20, 12: 30, 10: 4, 22: 6, 4: 7, 18: 8 };
    for (const [i, v] of Object.entries(u)) seed(c, "Holes2", ["Cglunko_upgBon", Number(i), 0], v);
    seed(c, "Holes2", ["Cglunko_Bdig", 0, 0], 9);
    seed(c, "Holes2", ["Cglunko_Pdig", 0, 0], 11);
    const want = (1 + 17 / 100) * 1.2 * 1.3 * (1 + 36 / 100) * (1 + 66 / 100) * (1 + (7 * 5) / 100) * (1 + (8 * 3) / 100);
    expect(Holes2(c, "Cglunko_DR", 0, 0)).toBeCloseTo(want, 12);
    expect(cell(RandoListo2, 13, 1)).toBeGreaterThan(0); // the table the upgrade values come from is there
  });
});
