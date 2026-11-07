// Task 3 (EXP plan): the edges of ExpMulti (N.js @4260536 raw) on a synthetic envelope (no real save, so CI runs them): the dispatcher, the LUK curve at
// its 1000 break, the lowest-level loop, the level ladders (cardSet0, mealClexp, newbie), the weekly boss, the weekly vote 15 (active), the bundle,
// the g04 Math.max(1, ·) when its product falls below 1, the Shiny Medallion gate on its map rules (a medallion map, a no-monster map, a town, a dungeon,
// a saved AFK target that is not the map's), and the one-character case. Every block ExpMulti(0) calls answers 0 unless the test seeds it (ZeroCache);
// only the block's own arithmetic and its map rules are under test. `REAL` lists the blocks a test leaves to their real code.
import { describe, it, expect } from "vitest";
import { IDforCardSETbonus, MapAFKtarget, MealINFO, NinjaInfo } from "@/lib/game/data";
import { MissingSaveKey, NotPorted } from "@/lib/game/errors";
import { ExpMulti } from "@/lib/game/njs/ExpMulti";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { MealBonus } from "@/lib/game/njs/MealBonus";
import { Summoning } from "@/lib/game/njs/Summoning";
import { type Data, type Seeds, synth, WB } from "../support/expStub";

const TASKS = (n: number) => ({ TaskZZ2: [[0, 0, n]] });
const lv = (n: number, extra: Data = {}): Data => ({ Lv0_0: [n, 0], ...extra });
const total = (data: Data, seeds: Seeds = {}, o: Parameters<typeof synth>[1] = {}) => ExpMulti(synth(data, { ...o, seeds: { ...WB, ...seeds } }), 0);

describe("ExpMulti dispatcher (synthetic, runs in CI)", () => {
  it("999 is Summoning(WinBonus, 23), every other d but 0 is not ported", () => {
    expect(ExpMulti(synth({}, { seeds: { 'Summoning["WinBonus",23,0]': 7.5 } }), 999)).toBe(7.5);
    for (const d of [1, 2, 5, 10, 998, -1]) expect(() => ExpMulti(synth({}), d), `d = ${d}`).toThrow(NotPorted);
  });
  it("with every block 0 the multiplier is the workbench alone", () => {
    expect(total({})).toBe(1);
    expect(total({}, { 'WorkbenchStuff["AdditionExtraEXPnDR",0,0]': 2.5 })).toBe(2.5);
  });
});

describe("the LUK curve (TotalStats LUK), N.js float order", () => {
  const at = (luk: number) => total({}, { 'TotalStats["LUK"]': luk });
  it("is (LUK + 1)^.37 - 1 over 30 below 1000, .8 x ((LUK - 1000) / (LUK + 2500)) + .3963 from 1000 on", () => {
    expect(at(0)).toBe(1 + (Math.pow(1, 0.37) - 1) / 30 / 1.8);
    expect(at(500)).toBe(1 + ((Math.pow(501, 0.37) - 1) / 30) / 1.8);
    expect(at(999)).toBe(1 + ((Math.pow(1000, 0.37) - 1) / 30) / 1.8);
    expect(at(1000)).toBe(1 + (0.8 * (0 / 3500) + 0.3963) / 1.8);
    expect(at(1000000)).toBe(1 + (0.8 * ((1000000 - 1000) / (1000000 + 2500)) + 0.3963) / 1.8);
  });
  it("talent 35 scales the curve (1 + T35 / 100), the curve is not divided by 100 (the rest of the pool is)", () => {
    const curve = 0.8 * ((5000 - 1000) / (5000 + 2500)) + 0.3963;
    expect(total({}, { 'TotalStats["LUK"]': 5000, "GetTalentNumber[1,35]": 50 })).toBe(1 + (curve * (1 + 50 / 100)) / 1.8);
    // an additive source is a percentage point: etc4 = 100 doubles
    expect(total({}, { 'EtcBonuses["4"]': 100 })).toBe(2);
  });
});

describe("the lowest-level loop: Tasks[2][0][2] > 0 and every other character's level above this one's (strict)", () => {
  const two = (a: number, b: number, tasks: number, seeds: Seeds = {}, player = 0) =>
    ExpMulti(synth({ Lv0_0: [a, 0], Lv0_1: [b, 0], ...TASKS(tasks) }, { chars: 2, player, seeds: { ...WB, ...seeds } }), 0);
  it("adds 3 x Tasks[2][0][2] + the Vault 12 upgrade as flat points when this character is the lowest", () => {
    expect(two(100, 101, 4, { 'Summoning["VaultUpgBonus",12,0]': 8 })).toBe(1 + (3 * 4 + 8) / 100);
  });
  it("is nothing for an equal level (a strict <), for a higher level, or with Tasks[2][0][2] = 0", () => {
    expect(two(100, 100, 4, { 'Summoning["VaultUpgBonus",12,0]': 8 })).toBe(1);
    expect(two(101, 100, 4, { 'Summoning["VaultUpgBonus",12,0]': 8 })).toBe(1);
    expect(two(100, 101, 0, { 'Summoning["VaultUpgBonus",12,0]': 8 })).toBe(1);
  });
  it("the other character is the lowest for its own call (player 1), and a lone character is its own lowest", () => {
    expect(two(100, 101, 4, { 'Summoning["VaultUpgBonus",12,0]': 8 }, 1)).toBe(1);
    expect(total({ ...TASKS(2) })).toBe(1 + 3 * 2 / 100);
  });
  it("Super Bit 19 (Noobie Gains) adds 50 % to the EXP percent factor, on the same condition", () => {
    const seeds = { 'GamingStatType["SuperBitType",19,0]': 1 };
    expect(two(100, 101, 4, seeds)).toBeCloseTo((1 + 50 / 100) * (1 + 12 / 100), 12);
    expect(two(100, 100, 4, seeds)).toBe(1);
    // the bit is read as == 1: 2 does not count
    expect(two(100, 101, 4, { 'GamingStatType["SuperBitType",19,0]': 2 })).toBe(1 + 12 / 100);
  });
  it("the bun_q bundle adds 20 to the same percent factor", () => {
    expect(total({ BundlesReceived: { bun_q: 1 } })).toBe(1 + 20 / 100);
    expect(total({ BundlesReceived: { bun_q: 2 } })).toBe(1);
    expect(total({ BundlesReceived: { bun_q: 1 }, ...TASKS(0) })).toBe(1 + 20 / 100);
  });
});

describe("the level-gated sources, active below their level (always 0 on every real save: every character is above level 120)", () => {
  const SET = "CardSetBonuses[0,\"0\"]";
  it("cardSet0: CardSetBonuses(0, \"0\") counts below level 50 only (the newbie ladder adds its own points)", () => {
    for (const [level, add] of [[49, 30 + 50], [50, 0], [120, 0], [10, 30 + 100], [9, 30 + 150]] as const) expect(total(lv(level), { [SET]: 30 }), `Lv ${level}`).toBeCloseTo(1 + add / 100, 12);
  });
  it("mealClexp: MealBonus(\"Clexp\") counts below level 120 only (seeded; no meal of the game carries that key, see the data test)", () => {
    const M = 'MealBonus["Clexp"]';
    expect(total(lv(119), { [M]: 40 })).toBe(1 + 40 / 100);
    expect(total(lv(120), { [M]: 40 })).toBe(1);
    expect(total(lv(1000), { [M]: 40 })).toBe(1);
  });
  it("newbie: +150 under level 10, +100 under 30, +50 under 50, nothing from 50 (the ladder is exclusive)", () => {
    for (const [level, add] of [[1, 150], [9, 150], [10, 100], [29, 100], [30, 50], [49, 50], [50, 0], [51, 0]] as const) expect(total(lv(level)), `Lv ${level}`).toBe(1 + add / 100);
  });
  it("the three together at level 5: card set + meal + newbie", () => {
    expect(total(lv(5), { [SET]: 3, 'MealBonus["Clexp"]': 4 })).toBe(1 + (3 + 4 + 150) / 100);
  });
  it("the real blocks: CardSetBonuses reads Cards[3] by the set's text, MealBonus has no \"Clexp\" meal in the game's data", () => {
    const key = (IDforCardSETbonus as Readonly<Record<string, string>>)["0"];
    expect(key).toBe("{%_EXP_if_below_Lv_50");
    const c = synth(lv(20, { CSetEq_0: { [key]: 25 } }), { real: ["CardSetBonuses"] });
    expect(CardSetBonuses(c, 0, "0")).toBe(25);
    expect(ExpMulti(synth(lv(20, { CSetEq_0: { [key]: 25 } }), { seeds: WB, real: ["CardSetBonuses"] }), 0)).toBe(1 + (25 + 100) / 100);
    expect(ExpMulti(synth(lv(60, { CSetEq_0: { [key]: 25 } }), { seeds: WB, real: ["CardSetBonuses"] }), 0)).toBe(1);
    expect((MealINFO as unknown as unknown[][]).some((r) => r[5] === "Clexp")).toBe(false);
    expect(MealBonus(synth(lv(20), { real: ["MealBonus"] }), "Clexp")).toBe(0);
  });
});

describe("the weekly boss: Math.min(150, WeeklyBoss.c) when the key exists", () => {
  it("counts the key's value up to 150", () => {
    expect(total({ WeeklyBoss: { c: 40 } })).toBe(1 + 40 / 100);
    expect(total({ WeeklyBoss: { c: 150 } })).toBe(1 + 150 / 100);
    expect(total({ WeeklyBoss: { c: 400 } })).toBe(1 + 150 / 100);
    expect(total({ WeeklyBoss: { c: 0 } })).toBe(1);
    expect(total({ WeeklyBoss: { d: 40 } })).toBe(1); // another key is not "c"
  });
});

const VOTING = ["Summoning[\"VotingBonusz\"", "Summoning2[\"VotingBonusz\""]; // Summoning hands the name to Summoning2
describe("the weekly vote 15 (Class EXP from Monsters), active (always 0 on every real save)", () => {
  it("is Summoning(VotingBonusz, 15) x the voting multi while vote 15 is the vote in force", () => {
    const NI = (NinjaInfo as unknown as unknown[][])[38];
    const base = Number(NI[1 + 3 * 15]); // NinjaInfo[38][1 + 3b], b = 15
    expect(base).toBeGreaterThan(0);
    const seeds = { 'Summoning["VotingBonuszMulti",0,0]': 2 };
    const active = ExpMulti(synth({}, { seeds: { ...WB, ...seeds }, real: VOTING, serverVars: { voteCategories: [15] } }), 0);
    expect(active).toBe(1 + (base * 2) / 100);
    // another vote in force, or none known: 0
    expect(ExpMulti(synth({}, { seeds: { ...WB, ...seeds }, real: VOTING, serverVars: { voteCategories: [7] } }), 0)).toBe(1);
    expect(ExpMulti(synth({}, { seeds: { ...WB, ...seeds }, real: VOTING, serverVars: null }), 0)).toBe(1);
    // the block alone
    expect(Summoning(synth({}, { seeds, real: VOTING, serverVars: { voteCategories: [15] } }), "VotingBonusz", 15, 0)).toBe(base * 2);
  });
});

describe("the groups: the g04 product below 1 is raised to 1 (Math.max(1, ·)), the rest are not", () => {
  const JELLY = 'JellyOperation["RoG_BonusQTY",30,0]';
  it("g04 at .5 is 1: the total does not drop, and a product above 1 multiplies", () => {
    expect(total({}, { [JELLY]: -50 })).toBe(1);
    expect(total({}, { [JELLY]: 100 })).toBe(2);
    // exactly 1 stays 1; the Companion 50 term has its own Math.max(1, Math.min(1.01, ·)) inside
    expect(total({}, { [JELLY]: 0 })).toBe(1);
    // Companion 50 is in g04 (capped at 1.01 by its own Math.min) and again as flat points in the pool (+100 %)
    expect(total({}, { "Companions[50]": 100 })).toBeCloseTo(1.01 * (1 + 100 / 100), 12);
  });
  it("a factor below 1 anywhere in g04 is absorbed only while the whole product stays under 1", () => {
    // .5 x (1 + 4 x .75 = 4) = 2: a factor below 1 inside a product above 1 is kept, the product is 2
    expect(total({}, { [JELLY]: -50, "Companions[160]": 0.75 })).toBe(0.5 * 4);
    // .5 x 1.5 = .75 -> 1
    expect(total({}, { [JELLY]: -50, 'JellyOperation["RoG_BonusQTY",62,0]': 50 })).toBe(1);
  });
  it("a save without WeeklyBoss is refused (MissingSaveKey), not a TypeError", () => {
    const c = synth({ WeeklyBoss: undefined }, { seeds: WB });
    expect(() => ExpMulti(c, 0)).toThrow(MissingSaveKey);
  });
  it("the groups outside g04 are plain products: g05 below 1 lowers the total", () => {
    expect(total({}, { 'EtcBonuses["84"]': -50 })).toBe(0.5);
    // g08 (classy) is Math.max(1, ·) too
    expect(total({}, { 'GamingStatType["SuperBitType",24,0]': 0.3 })).toBe(1);
    expect(total({}, { 'GamingStatType["SuperBitType",24,0]': 5 })).toBe(5 * Math.pow(1.03, 0));
  });
});

describe("the map rules: the Shiny Medallion gate (GenINFO[17]) reads MapAFKtarget[CurrentMap], never the saved AFK target (Ruling II)", () => {
  const MED = { 'getbonus2[1,429,-1]': 3 };
  const target = (m: number) => (MapAFKtarget as unknown as string[])[m];
  const withMedallion = (m: number) => ({ Compass: [[], [], [], [target(m)]] });
  it("a medallion map: the factor max(1, getbonus2(1, 429, -1)) applies, and below 1 it is 1", () => {
    expect(target(1)).toBe("mushG");
    expect(total(withMedallion(1), MED, { map: 1 })).toBe(3);
    expect(total(withMedallion(1), { 'getbonus2[1,429,-1]': 0.4 }, { map: 1 })).toBe(1);
  });
  it("without the monster's medallion in Compass[3], or with another one, the gate is shut", () => {
    expect(total({}, MED, { map: 1 })).toBe(1);
    expect(total({ Compass: [[], [], [], ["frogG", "w6a1"]] }, MED, { map: 1 })).toBe(1);
  });
  it("a map with no monster (Z, Nothing) or a town never opens it and never throws, even with every medallion", () => {
    expect(target(33)).toBe("Z");
    expect(target(150)).toBe("Nothing");
    const all = { Compass: [[], [], [], ["mushG", "frogG", "w6a1"]] };
    expect(total(all, MED, { map: 33 })).toBe(1);
    expect(total(all, MED, { map: 150 })).toBe(1);
    // a map past the data (no MapAFKtarget entry) is the same: nothing to hold a medallion of
    expect(total(all, MED, { map: 99999 })).toBe(1);
  });
  it("a dungeon map (40) takes its default target's medallion like any map; Dungon's assumption does not stop it", () => {
    expect(total(withMedallion(40), MED, { map: 40 })).toBe(3);
    expect(total({}, MED, { map: 40 })).toBe(1);
  });
  it("the saved AFK target is not read: a character whose target holds a medallion on another map's monster gets nothing", () => {
    // on map 251 with the saved target 'mushG' kept (CurrentMap_0 = 251), Compass[3] holding mushG: the gate looks at MapAFKtarget[251] only
    const d = { Compass: [[], [], [], ["mushG"]], CurrentMap_0: 251, AFKtarget_0: "mushG" };
    expect(target(251)).not.toBe("mushG");
    expect(total(d, MED, { map: 251 })).toBe(1);
    // and the opposite: the map's own monster has the medallion while the saved target is something else
    const e = { ...withMedallion(251), CurrentMap_0: 251, AFKtarget_0: "Nothing" };
    expect(total(e, MED, { map: 251 })).toBe(3);
  });
  it("the medallion multiplies before g04 (a g04 under 1 is raised to 1 and the gate still applies)", () => {
    expect(total(withMedallion(1), { ...MED, 'JellyOperation["RoG_BonusQTY",30,0]': -50 }, { map: 1 })).toBe(3);
  });
});
