// Task 8 (Damage plan): the edges of DamageDealed (@4105019) on a synthetic envelope (no real save, so CI runs them): the map rules (43
// replaces Max, 306 divides it, any other map is neutral), the soft caps and the Reliquarium exponent at their thresholds as floats in N.js
// order, the late multipliers, the Mastery path and the runtime leaves. DamageDealed's own arithmetic is what is under test: every block it
// calls is answered from the Ctx cache (`stubbed`), so each value is set by hand, and only the save reads DamageDealed makes itself are in
// the save.
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { ArmoryUpg } from "@/lib/game/data";
import { NotPorted } from "@/lib/game/errors";
import { DamageDealed } from "@/lib/game/njs/DamageDealed";
import type { TraceNode } from "@/lib/game/trace";

type Data = Record<string, unknown>;
const env = (data: Data): GameEnvelope =>
  ({ data, charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 }) as unknown as GameEnvelope;

/** What DamageDealed reads from the save itself: class 1 (its first class is 1, whose primary stat is LUK), no food, nothing else. */
const BASE: Data = {
  CharacterClass_0: 1,
  FoodSlO_0: 0,
  EquipOrder_0: [[], [], []],
  EquipQTY_0: [[], [], []],
  Lv0_0: [],
  OptLacc: [],
  Dream: [],
  Divinity: [],
  WeeklyBoss: {},
  QuestComplete_0: {},
  InventoryOrder_0: [],
  ItemQTY_0: [],
  FamValMinigameHiscores: [0],
  Menagerie: [[], [], [], [], [], [0, 0, 0]],
};

// The calls that compute instead of being answered: DamageDealed itself, the dungeon test (Dungon reads the map) and the runtime leaves
const LIVE = /^(DamageDealed|Dungon)\[|^GetBuffBonuses\[(108|124),2\]$|^Summoning\["GrimoireWraith"|^Windwalker\["CompassTempest"|^ArcaneType\["TesseractArcanist"/;
// The two blocks whose neutral value is 1 (DN.DamageDealtLIST[2] starts at the Workbench's, [1] is times the golden food's multiplier)
const ONE: Record<string, number> = { 'WorkbenchStuff["AdditionExtraDMG",0,0]': 1, 'GoldFoodBonuses["Damage"]': 1 };

/** The cache key without its `player|map|` head: `<Fn><args as JSON>`. */
const call = (key: string) => key.slice(key.indexOf("|", key.indexOf("|") + 1) + 1);
/** A block cache that answers every call DamageDealed makes: `set` (by call) first, then 1 for ONE, else 0; LIVE calls compute. */
class Stubbed extends Map<string, number> {
  constructor(private readonly answers: Record<string, number>) {
    super();
  }
  override get(key: string): number | undefined {
    if (super.has(key)) return super.get(key);
    const c = call(key);
    if (LIVE.test(c)) return undefined;
    return this.answers[c] ?? ONE[c] ?? 0;
  }
}
const stubbed = (set: Record<string, number>, o: { map?: number; data?: Data; trace?: boolean } = {}): Ctx => ({
  ...makeCtx(buildGameState(env({ ...BASE, ...o.data })), { player: 0, map: o.map ?? 251, trace: o.trace }),
  cache: new Stubbed(set),
});
const max = (set: Record<string, number>, o?: { map?: number; data?: Data }) => DamageDealed(stubbed(set, o), "Max");
// The base damage (DN.DamageDealtLIST[0]) is ArcadeBonus(0) here, the damage % ([1]) 1 + GetBribeBonus("30") / 100, the multipliers
// ([2]) the Workbench's AdditionExtraDMG: every other term is neutral
const BASE_DMG = "ArcadeBonus[0]";
const PCT = 'GetBribeBonus["30"]';
const MULT = 'WorkbenchStuff["AdditionExtraDMG",0,0]';

describe("DamageDealed map rules (synthetic, runs in CI)", () => {
  it("map 43: the Royal Guardian arena replaces Max with RoyalG('RatDMG'), (10 + Armory 35) x (1 + Armory 36 / 100); Mastery is .2", () => {
    const levels = Array<number>(83).fill(0);
    levels[35] = 7;
    levels[36] = 4;
    // a plain Ctx: nothing but the arena is in the save, so any other read DamageDealed made would throw
    const c = makeCtx(buildGameState(env({ RoyalG: [[0, 0, 0, 0, 0, 0, 0, 0], [], levels] })), { player: 0, map: 43 });
    const a35 = 7 * Number((ArmoryUpg as unknown as unknown[][])[35][5]);
    const a36 = 4 * Number((ArmoryUpg as unknown as unknown[][])[36][5]);
    expect(a35 * a36).toBeGreaterThan(0);
    expect(DamageDealed(c, "Max")).toBe((10 + a35) * (1 + a36 / 100));
    expect(DamageDealed(c, "Mastery")).toBe(0.2);
    expect(DamageDealed(c, "Min")).toBe(DamageDealed(c, "Max") * 0.2);
    // on any other map the same save reads the whole formula (here: the class, absent)
    expect(() => DamageDealed(makeCtx(c.state, { player: 0, map: 44 }), "Max")).toThrow(/CharacterClass/);
  });

  it("map 306: the Clamworks divide the multipliers by 100^Menagerie[5][2]; another map (251, 1) is neutral", () => {
    const set = { [BASE_DMG]: 30, [MULT]: 7 };
    const menagerie = (k: number) => ({ Menagerie: [[], [], [], [], [], [0, 0, k]] });
    expect(max(set)).toBe(30 * 1 * 7);
    expect(max(set, { map: 1 })).toBe(max(set));
    expect(max(set, { map: 306, data: menagerie(2) })).toBe((30 * 1 * 7) / Math.pow(100, 2));
    expect(max(set, { map: 306, data: menagerie(0) })).toBe(max(set)); // 100^0 = 1
    expect(max(set, { map: 251, data: menagerie(2) })).toBe(max(set)); // only on map 306
  });

  it("a dungeon map answers with the dungeon run's stats: runtime leaves, not a silent 0", () => {
    const c = stubbed({ [BASE_DMG]: 30 }, { map: 40, trace: true });
    expect(DamageDealed(c, "Max")).toBe(0);
    expect(DamageDealed(c, "Mastery")).toBe(0);
    const notes = JSON.stringify(c.trace);
    expect(notes).toContain('"block":"DungeonStat(DMG)"');
    expect(notes).toContain('"block":"DungeonStat(MASTERY)"');
    expect(notes).toContain("runtime: dungeon stat, not counted");
  });
});

describe("DamageDealed soft caps and the Reliquarium, as floats in N.js order (synthetic, runs in CI)", () => {
  it("base damage (@4109718): x^.91 past 4000, then x^.84 past 15000; at 4000 exactly, nothing", () => {
    const base = (x: number) => max({ [BASE_DMG]: x });
    expect(base(4000)).toBe(4000);
    expect(base(4001)).toBe(4e3 + Math.max(Math.pow(4001 - 4e3, 0.91), 0));
    // one cap only: 4000 + 20000^.91 is below 15000
    expect(4e3 + Math.pow(20000 - 4e3, 0.91)).toBeLessThan(15e3);
    expect(base(20000)).toBe(4e3 + Math.max(Math.pow(20000 - 4e3, 0.91), 0));
    // both: the second cap reads the first one's result
    let v = 4e3 + Math.max(Math.pow(4e6 - 4e3, 0.91), 0);
    expect(v).toBeGreaterThan(15e3);
    v = 15e3 + Math.max(Math.pow(v - 15e3, 0.84), 0);
    expect(base(4e6)).toBe(v);
  });

  it("the base damage foods (@4110296) are added after the cap: Amount x FoodBonuses('BaseDmgBoostsEffectBonus') of each slot", () => {
    const data = { FoodSlO_0: 2, EquipOrder_0: [[], [], ["FoodPotOr2", "FoodPotOr4"]], EquipQTY_0: [[], [], [3, 0]] }; // the second slot is empty
    const set = { [BASE_DMG]: 20000, 'FoodBonuses["BaseDmgBoostsEffectBonus"]': 1.5 };
    expect(max(set, { data })).toBe(4e3 + Math.max(Math.pow(20000 - 4e3, 0.91), 0) + 150 * 1.5);
  });

  it("damage % (@4120180): x^.86 past 100, then 2e6 x (v / 2e6)^.5, then 1e8 x (v / 1e8)^.3", () => {
    const pct = (b: number) => max({ [BASE_DMG]: 1, [PCT]: b }); // DN.DamageDealtLIST[1] = 1 + b / 100
    expect(pct(9900)).toBe(100);
    expect(pct(10000)).toBe(100 + Math.max(Math.pow(1 + 10000 / 100 - 100, 0.86), 0));
    let v = 1 + 1e14 / 100;
    v = 100 + Math.max(Math.pow(v - 100, 0.86), 0);
    expect(v).toBeGreaterThan(1e8);
    v = 2e6 * Math.pow(v / 2e6, 0.5);
    expect(v).toBeGreaterThan(1e8);
    v = 1e8 * Math.pow(v / 1e8, 0.3);
    expect(pct(1e14)).toBe(v);
  });

  it("multipliers (@4121017): x^.86 past 100, then the brackets 2e7 (.8), 5e8 (.6), 2e9 (.45), 15e9 (.36), 6e10 (.28), each on the last", () => {
    const mult = (w: number) => max({ [BASE_DMG]: 1, [MULT]: w });
    expect(mult(100)).toBe(100);
    expect(mult(101)).toBe(100 + Math.max(Math.pow(1, 0.86), 0));
    let v = 1e30;
    v = 100 + Math.max(Math.pow(v - 100, 0.86), 0);
    for (const [t, e] of [[2e7, 0.8], [5e8, 0.6], [2e9, 0.45], [15e9, 0.36], [6e10, 0.28]]) {
      expect(v).toBeGreaterThan(t); // each bracket is crossed
      v = t * Math.pow(v / t, e);
    }
    expect(mult(1e30)).toBe(v);
  });

  // Each bracket on both sides of its threshold: an input whose value, after the steps before the bracket, lands a hair under the
  // threshold (the bracket leaves it) and a hair over (the bracket takes it). The expected values run the caps in N.js order.
  it("every threshold (15000; 2e6, 1e8; 2e7, 5e8, 2e9, 15e9, 6e10): a hair under is not capped by it, a hair over is", () => {
    const soft = (v: number, t: number, e: number) => (t < v ? t + Math.max(Math.pow(v - t, e), 0) : v);
    const bracket = (v: number, t: number, e: number) => (t < v ? t * Math.pow(v / t, e) : v);
    type Step = (v: number) => number;
    const layers: { key: string; input: (x: number) => number; steps: [threshold: number, step: Step][] }[] = [
      { key: BASE_DMG, input: (x) => x, steps: [[4e3, (v) => soft(v, 4e3, 0.91)], [15e3, (v) => (4e3 < v ? soft(v, 15e3, 0.84) : v)]] },
      { key: PCT, input: (x) => 1 + x / 100, steps: [[100, (v) => soft(v, 100, 0.86)], [2e6, (v) => bracket(v, 2e6, 0.5)], [1e8, (v) => bracket(v, 1e8, 0.3)]] },
      {
        key: MULT,
        input: (x) => x,
        steps: [[100, (v) => soft(v, 100, 0.86)], ...([[2e7, 0.8], [5e8, 0.6], [2e9, 0.45], [15e9, 0.36], [6e10, 0.28]] as const).map(([t, e]): [number, Step] => [t, (v) => bracket(v, t, e)])],
      },
    ];
    let checked = 0;
    for (const { key, input, steps } of layers) {
      const run = (x: number, upTo = steps.length) => steps.slice(0, upTo).reduce((v, [, s]) => s(v), input(x));
      for (let i = 1; i < steps.length; i++) {
        const t = steps[i][0];
        // the value before bracket i grows with the input: bisect the input (on a log scale) to land at t x f
        const at = (f: number) => {
          let lo = 0, hi = 60;
          for (let n = 0; n < 200; n++) {
            const mid = (lo + hi) / 2;
            if (run(Math.pow(10, mid), i) < t * f) lo = mid;
            else hi = mid;
          }
          return Math.pow(10, hi);
        };
        for (const f of [1 - 1e-6, 1 + 1e-6]) {
          const x = at(f);
          expect(run(x, i) > t, `${key} bracket ${t} at ${f}`).toBe(f > 1);
          const set = { [BASE_DMG]: 1, [key]: x };
          expect(max(set), `${key} bracket ${t} at ${f}`).toBe(run(x));
          checked++;
        }
      }
    }
    expect(checked).toBe(2 * (1 + 2 + 5));
  });

  it("the multipliers after the caps (@4122686) are not capped: EtcBonuses('72') = 100 doubles the capped value", () => {
    const capped = 100 + Math.max(Math.pow(1000 - 100, 0.86), 0);
    expect(max({ [BASE_DMG]: 1, [MULT]: 1000, 'EtcBonuses["72"]': 100 })).toBe(capped * (1 + 100 / 100));
  });

  it("the Reliquarium (@4124657) raises the capped multipliers to 4 / (5 + OptionsListAccount[473]), before map 306 divides them", () => {
    const set = { [BASE_DMG]: 1, [MULT]: 1000, 'Thingies["ReliquariumInPosession",0,0]': 1 };
    const capped = 100 + Math.max(Math.pow(1000 - 100, 0.86), 0);
    const data = { OptLacc: Object.assign([], { 473: 3 }) };
    expect(max(set, { data })).toBe(Math.pow(capped, 4 / (5 + 3)));
    expect(max({ ...set, 'Thingies["ReliquariumInPosession",0,0]': 0 }, { data })).toBe(capped); // not carried: no exponent
    const at306 = { ...data, Menagerie: [[], [], [], [], [], [0, 0, 1]] };
    expect(max(set, { map: 306, data: at306 })).toBe(Math.pow(capped, 4 / (5 + 3)) / Math.pow(100, 1));
  });
});

describe("DamageDealed late rules, Mastery and runtime leaves (synthetic, runs in CI)", () => {
  it("the weekly boss (@4119435) once WeeklyBoss has g: x (1 + min(150, g) / 100); the damage bundle (@4124196) x 1.5", () => {
    const set = { [BASE_DMG]: 10, [MULT]: 2 };
    expect(max(set, { data: { WeeklyBoss: { g: 40 } } })).toBe(10 * 1 * (2 * (1 + 40 / 100)));
    expect(max(set, { data: { WeeklyBoss: { g: 900 } } })).toBe(10 * 1 * (2 * (1 + 150 / 100)));
    expect(max(set, { data: { BundlesReceived: { bon_a: 1 } } })).toBe(10 * 1 * (1.5 * 2));
    expect(max(set)).toBe(10 * 1 * 2); // neither
  });

  it("a beginner (class 2) carrying the Elderly Peanut (Quest47) before the Cactolyte quest hits half (@4119765)", () => {
    const set = { [BASE_DMG]: 10, [MULT]: 2 };
    const peanut = (cls: number, quest: unknown, qty: number) => ({ CharacterClass_0: cls, QuestComplete_0: { Cactolyte3: quest }, InventoryOrder_0: ["Quest47", "Blank"], ItemQTY_0: [qty, 0] });
    expect(max(set, { data: peanut(2, 0, 1) })).toBe(10 * 1 * (0.5 * 2));
    expect(max(set, { data: peanut(2, 1, 1) })).toBe(10 * 1 * 2); // quest done
    expect(max(set, { data: peanut(2, 0, 0) })).toBe(10 * 1 * 2); // no peanut
    expect(max(set, { data: peanut(1, 0, 1) })).toBe(10 * 1 * 2); // another class
  });

  it("Mastery (@4106867) is min(.8, .35 - talent 113 (tab 2) / 100 + (bubble + card 21 + talent 123 + EtcBonuses 21) / 100); Min = Max x Mastery", () => {
    const set = { [BASE_DMG]: 10, 'GetTalentNumber[2,113]': 5, 'DNSM.AlchBubbles["Mastery"]': 10, "CardBonusREAL[21]": 3, "GetTalentNumber[1,123]": 2, 'EtcBonuses["21"]': 1 };
    const c = stubbed(set);
    expect(DamageDealed(c, "Mastery")).toBe(Math.min(0.8, 0.35 - 5 / 100 + (10 + (3 + (2 + 1))) / 100));
    expect(DamageDealed(c, "Min")).toBe(DamageDealed(c, "Max") * DamageDealed(c, "Mastery"));
    expect(DamageDealed(stubbed({ ...set, 'DNSM.AlchBubbles["Mastery"]': 90 }), "Mastery")).toBe(0.8);
  });

  it("the active buffs 108 / 124 and the three masterclass forms are runtime leaves, and Max is not 0 with them", () => {
    const c = stubbed({ [BASE_DMG]: 10, [MULT]: 2 }, { trace: true });
    expect(DamageDealed(c, "Max")).toBe(20);
    const runtime: string[] = [];
    const walk = (n: TraceNode) => {
      if (n.note?.startsWith("runtime:")) runtime.push(n.block);
      n.children.forEach(walk);
    };
    walk(c.trace!);
    expect(runtime.sort()).toEqual(["ArcaneType(TesseractArcanist)", "GetBuffBonuses(108)", "GetBuffBonuses(124)", "Summoning(GrimoireWraith)", "Windwalker(CompassTempest)"]);
  });

  it("only Min, Max and Mastery are ported ('RNG', one random hit, is not)", () => {
    expect(() => DamageDealed(stubbed({}), "RNG")).toThrow(expect.objectContaining({ name: "NotPorted", sub: "RNG" }));
    expect(() => DamageDealed(stubbed({}), "Avg")).toThrow(NotPorted);
  });
});
