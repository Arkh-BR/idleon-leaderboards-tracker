// Task 3 (DR plan): the edges of TotalStats("Drop_Rarity") (N.js @4190432 raw) on a synthetic envelope (no real save, so CI runs them): the LUK curve
// on both sides of its 1E3 break, the Σ and DropRateLUK2's caps, the chip cap under, at and over 5, the order of the bundles, the Workbench and
// OLA[232], the max(1, ·) factors, the Arcane map bonus of ctx.map, the Cove (map 216 and cavern 17, per character) and a dungeon map (Ruling Y).
// Every block the sub-case calls answers 0 unless the test seeds it (expStub's ZeroCache); only the sub-case's own arithmetic and map rules are under
// test. `REAL` lists the blocks left to their code: the sub-case itself and Dungon (the map rule of Ruling Y).
import { describe, it, expect } from "vitest";
import { MissingSaveKey } from "@/lib/game/errors";
import type { TraceNode } from "@/lib/game/ctx";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { type Data, type Seeds, synth, WB } from "../support/expStub";

const REAL = ['TotalStats["Drop_Rarity"]', "Dungon["];
type Opts = { map?: number; chars?: number; player?: number; real?: string[]; trace?: boolean };
const ctxOf = (data: Data = {}, seeds: Seeds = {}, o: Opts = {}) =>
  synth({ Dream: Array<number>(20).fill(0), ...data }, { ...o, seeds: { ...WB, ...seeds }, real: [...REAL, ...(o.real ?? [])] });
const dr = (data: Data = {}, seeds: Seeds = {}, o: Opts = {}) => TotalStats(ctxOf(data, seeds, o), "Drop_Rarity");
/** n percentage points of the Σ: one of its terms (talent 279) seeded to n. */
const sigma = (n: number): Seeds => ({ "GetTalentNumber[1,279]": n });
const ola = (at: Record<number, unknown>) => ({ OptLacc: Object.assign(Array<unknown>(700).fill(0), at) });
const CHIP = 'chipBonuses["dr"]';
const WB2 = { 'WorkbenchStuff["AdditionExtraEXPnDR",0,0]': 2 };
const COVE = 'Holes2["Cglunko_DR",0,0]';

describe("the base: 1 + (1.4 x DropRateLUK + Σ / 100) (synthetic, runs in CI)", () => {
  it("with every block 0 the total is 1, and the Workbench multiplies it", () => {
    expect(dr()).toBe(1);
    expect(dr({}, { 'WorkbenchStuff["AdditionExtraEXPnDR",0,0]': 2.5 })).toBe(2.5);
  });
  it("DropRateLUK is (LUK + 1)^.37 - 1 over 40 below 1000, .5 x ((LUK - 1000) / (LUK + 2500)) + .297 from 1000 on, and sits outside the /100", () => {
    const at = (luk: number) => dr({}, { 'TotalStats["LUK"]': luk });
    expect(at(0)).toBe(1);
    expect(at(500)).toBe(1 + 1.4 * ((Math.pow(501, 0.37) - 1) / 40));
    // 999 takes the power branch, 1000 the other one (the two meet within 1e-4 there)
    expect(at(999)).toBe(1 + 1.4 * ((Math.pow(1000, 0.37) - 1) / 40));
    expect(at(999)).not.toBe(1 + 1.4 * (0.5 * ((999 - 1e3) / (999 + 2500)) + 0.297));
    expect(at(1000)).toBe(1 + 1.4 * (0.5 * ((1000 - 1e3) / (1000 + 2500)) + 0.297));
    expect(at(1e6)).toBe(1 + 1.4 * (0.5 * ((1e6 - 1e3) / (1e6 + 2500)) + 0.297));
  });
  it("Σ is percentage points; DropRateLUK2's card terms are each capped; talent 239 is x the Royal Guardian stat total", () => {
    expect(dr({}, sigma(50))).toBe(1 + 50 / 100);
    const card = (c: string, lv: number) => dr({}, { [`RunCodeOfTypeXforThingY["CardLv","${c}"]`]: lv });
    expect(card("mini5a", 4)).toBe(1 + 6 / 100);
    expect(card("mini5a", 20)).toBe(1 + 10 / 100); // min(1.5 x 20, 10)
    expect(card("anni4Event1", 20)).toBe(1 + 20 / 100); // min(2 x 20, 20)
    expect(card("luckEvent1", 20)).toBe(1 + 25 / 100); // min(3 x 20, 25)
    // min(4 x caveC + 6 x caveD, 100): the cap is on the pair
    expect(dr({}, { 'RunCodeOfTypeXforThingY["CardLv","caveC"]': 20, 'RunCodeOfTypeXforThingY["CardLv","caveD"]': 5 })).toBe(1 + 100 / 100);
    expect(dr({}, { "GetTalentNumber[1,239]": 2, 'RoyalG["TotalStatz",0,0]': 30 })).toBe(1 + 60 / 100);
    // OptionsListAccount[189] scales talent 655, Dream[10] gives 5 each
    expect(dr({ ...ola({ 189: 3 }) }, { "GetTalentNumber[1,655]": 4 })).toBe(1 + 12 / 100);
    expect(dr({ Dream: Object.assign(Array<number>(20).fill(0), { 10: 2 }) })).toBe(1 + 10 / 100);
  });
});

describe("the chip: min(5, total + chipBonuses(\"dr\") / 100), only while the total is under 5, before the bundles and the Workbench", () => {
  it("under 5 it adds, up to 5", () => {
    expect(dr({}, { ...sigma(300), [CHIP]: 50 })).toBe(4.5);
    expect(dr({}, { ...sigma(300), [CHIP]: 100 })).toBe(5);
    expect(dr({}, { ...sigma(300), [CHIP]: 200 })).toBe(5);
  });
  it("at 5 and over it does nothing", () => {
    expect(dr({}, { ...sigma(400), [CHIP]: 200 })).toBe(5);
    expect(dr({}, { ...sigma(500), [CHIP]: 200 })).toBe(6);
  });
  it("the capped total is what the Workbench and the bundle then take", () => {
    expect(dr({}, { ...sigma(300), [CHIP]: 200, ...WB2 })).toBe(10);
    expect(dr({ BundlesReceived: { bun_v: 1 } }, { ...sigma(300), [CHIP]: 200 })).toBe(7);
  });
});

describe("then, in N.js order: +2 with bun_v, x the Workbench, +.3 with OptionsListAccount[232] >= 1, x1.2 with bun_p", () => {
  it("bun_v adds 2 before the Workbench multiplies (loosely == 1)", () => {
    expect(dr({ BundlesReceived: { bun_v: 1 } }, WB2)).toBe((1 + 2) * 2);
    expect(dr({ BundlesReceived: { bun_v: "1" } }, WB2)).toBe((1 + 2) * 2);
    expect(dr({ BundlesReceived: { bun_v: 2 } }, WB2)).toBe(2);
  });
  it("OptionsListAccount[232] adds .3 after the Workbench, from 1 on", () => {
    expect(dr(ola({ 232: 1 }), WB2)).toBe(2 + 0.3);
    expect(dr(ola({ 232: 3 }), WB2)).toBe(2 + 0.3);
    expect(dr(ola({ 232: 0.99 }), WB2)).toBe(2);
  });
  it("bun_p multiplies by 1.2 after the .3", () => {
    expect(dr({ ...ola({ 232: 1 }), BundlesReceived: { bun_p: 1 } }, WB2)).toBe(1.2 * (2 + 0.3));
    expect(dr({ BundlesReceived: { bun_p: 0 } }, WB2)).toBe(2);
  });
});

describe("the post-processing factors", () => {
  it("each 1 + x / 100 factor multiplies", () => {
    expect(dr({}, { 'RoyalG["StatueBon",1,0]': 50 })).toBe(1.5);
    expect(dr({}, { 'DNSM.FamBonusQTYs["32"]': 50, 'DNSM.AlchVials["7drMulto"]': 100 })).toBe(1.5 * 2);
    // Sushi 48 and Jelly 14 share one factor
    expect(dr({}, { 'SushiStuff["RoG_BonusQTY",48,0]': 30, 'JellyOperation["RoG_BonusQTY",14,0]': 20 })).toBe(1 + 50 / 100);
    // Dream Cloud 69 is 5 % a level
    expect(dr({}, { 'Dreamstuff["CloudBonus",69]': 1 })).toBe(1 + (5 * 1) / 100);
  });
  // each seeded alone at its own value, so a factor that reads another one's key (EtcBonuses "91" where "99" is) leaves its seed unread and fails
  const FACTORS: [string, number, number][] = [
    ['MenagerieStuff["BoostQTY",24,0]', 10, 1.1],
    ["CardBonusREAL[101]", 20, 1.2],
    ["Companions[168]", 1, 1.3], // 1 + .3 x Companions(168)
    ['Summoning["TomeBonus",7,0]', 40, 1.4],
    ['EtcBonuses["99"]', 50, 1.5],
    ['Minehead["BonusQTY",0,0]', 60, 1.6],
    ['Ninja["PristineBon",3,0]', 70, 1.7],
    ['EtcBonuses["91"]', 80, 1.8],
  ];
  it.each(FACTORS)("%s at %s alone gives the factor %s", (key, seed, factor) => {
    expect(dr({}, { [key]: seed })).toBe(factor);
  });
  it("all of them at once give the product of their factors (each key read once, none twice)", () => {
    expect(dr({}, Object.fromEntries(FACTORS.map(([k, v]) => [k, v])))).toBeCloseTo(1.1 * 1.2 * 1.3 * 1.4 * 1.5 * 1.6 * 1.7 * 1.8, 12);
  });
  it("the Glimbo factor is max(1, GlimboDRmulti): below 1 it is 1", () => {
    expect(dr({}, { 'Minehead["GlimboDRmulti",0,0]': 0.5 })).toBe(1);
    expect(dr({}, { 'Minehead["GlimboDRmulti",0,0]': 2 })).toBe(2);
  });
  it("Companion 132 is a Σ term and its own factor, 1 + min(.5, ·) + .2 x CompLV2(132)", () => {
    expect(dr({}, { "Companions[132]": 2 })).toBe((1 + 2 / 100) * (1 + 0.5));
    expect(dr({}, { "Companions[132]": 0.25, "CompLV2[132]": 1 })).toBe((1 + 0.25 / 100) * (1 + (0.25 + 0.2 * 1)));
  });
  it("max(1, min(1.3, 1 + Companions(26)) x (1 + .5 x Companions(160))) and max(1, min(1.01, 1 + Companions(50) / 2500))", () => {
    expect(dr({}, { "Companions[26]": 0.5 })).toBe(1.3);
    expect(dr({}, { "Companions[160]": 1 })).toBe(1.5);
    expect(dr({}, { "Companions[26]": 0.5, "Companions[160]": 1 })).toBe(1.3 * 1.5);
    expect(dr({}, { "Companions[26]": -0.5 })).toBe(1); // a product under 1 is raised to 1
    // Companion 50 is also a Σ term: 100 points there, and its factor capped at 1.01
    expect(dr({}, { "Companions[50]": 100 })).toBe(2 * 1.01);
  });
});

describe("the Arcane map bonus is slot 0 of the MapBon row of ctx.map", () => {
  // ArcaneMapMulti_bon (@11087291) left to its code; ArcaneMapMulti (the kills' curve) and its cap seeded
  const ARC = ['ArcaneType["ArcaneMapMulti_bon"'];
  const mapBon = (rows: Record<number, number[]>) => ({ MapBon: Array.from({ length: 300 }, (_, m) => rows[m] ?? []) });
  const seeds = { 'ArcaneType["ArcaneMapMulti_bonMAX",0,0]': 100, 'ArcaneType["ArcaneMapMulti",500,0]': 30, 'ArcaneType["ArcaneMapMulti",900,0]': 70 };
  it("the map's own row, slot 0 (Drop Rate)", () => {
    expect(dr(mapBon({ 251: [500, 900, 900] }), seeds, { real: ARC })).toBe(1.3);
    // another map's row is not read: map 250 has none (fewer than 3 slots), so the factor is 1
    expect(dr(mapBon({ 251: [500, 900, 900] }), seeds, { map: 250, real: ARC })).toBe(1);
  });
});

describe("the Cove: on map 216, a character in cavern 17 (Holes[0][its index], loosely) gets Holes2(\"Cglunko_DR\") in place of the total", () => {
  const rest = { ...sigma(300), [CHIP]: 50, [COVE]: 3.5 };
  it("map 216 in cavern 17: the Cove's value, whatever the rest", () => {
    expect(dr({ Holes: [[17]] }, rest, { map: 216 })).toBe(3.5);
    expect(dr({ Holes: [["17"]] }, rest, { map: 216 })).toBe(3.5);
    // it replaces, even below the normal total
    expect(dr({ Holes: [[17]] }, { ...rest, [COVE]: 0.5 }, { map: 216 })).toBe(0.5);
  });
  it("another cavern on map 216, or cavern 17 on another map: the normal total", () => {
    expect(dr({ Holes: [[16]] }, rest, { map: 216 })).toBe(4.5);
    expect(dr({ Holes: [[17]] }, rest, { map: 215 })).toBe(4.5);
    // off map 216 the Holes list is not read
    expect(dr({}, rest, { map: 251 })).toBe(4.5);
    expect(() => dr({}, rest, { map: 216 })).toThrow(MissingSaveKey);
  });
  it("the cavern is the current character's", () => {
    const holes = { Holes: [[0, 17]] };
    expect(dr(holes, rest, { map: 216, chars: 2, player: 0 })).toBe(4.5);
    expect(dr(holes, rest, { map: 216, chars: 2, player: 1 })).toBe(3.5);
  });
});

describe("a dungeon map (Ruling Y): Dungon() answers -1 under an assumed: leaf, so the normal total", () => {
  const find = (n: TraceNode, test: (n: TraceNode) => boolean): TraceNode | undefined => (test(n) ? n : n.children.map((k) => find(k, test)).find(Boolean));
  it("map 40 (inside) and 39 (the lobby) give the normal total, and say so", () => {
    for (const map of [40, 39]) {
      const c = ctxOf({}, { ...sigma(300), ...WB2 }, { map, trace: true });
      expect(TotalStats(c, "Drop_Rarity"), `map ${map}`).toBe(8);
      expect(find(c.trace!, (n) => n.block === "Dungon()")?.note, `map ${map}`).toMatch(/^assumed: /);
    }
    expect(dr({}, { ...sigma(300), ...WB2 }, { map: 251 })).toBe(8);
  });
});
