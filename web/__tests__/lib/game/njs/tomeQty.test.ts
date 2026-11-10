// The Tome's quantities on lib/game (njs/TomeQTY.ts), `_customEvent_TomeQTY` @5739147:
// - on a synthetic envelope (CI): one assertion per ported quantity, its value worked out from the N.js expression;
// - on the 5 newest real saves (skipIf): compareTome against the frozen computeTome, no difference outside TOME_KNOWN.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, goldenSaves } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareTome, PENDING_QTY } from "../support/tomeCompare";
import { newestSaves } from "@/lib/diagnose/characterize";
import { DeathNoteMobs, MapDetails, NinjaInfo, PetStats, RANDOlist, SceneNPCquestOrder, Tome } from "@/lib/game/data";
import { NotPorted } from "@/lib/game/errors";
import { Ninja } from "@/lib/game/njs/Ninja";
import { TomeQTY, tomeQty } from "@/lib/game/njs/TomeQTY";
import type { TraceNode } from "@/lib/game/trace";
import { synth, type Data, type Seeds } from "../support/expStub";

const OLA = (set: Record<number, unknown> = {}) => {
  const o: unknown[] = Array<number>(701).fill(0);
  o[202] = 0.5; // the Crystal Spawn record: 1 / it is TomeQTY[16]
  for (const [i, v] of Object.entries(set)) o[Number(i)] = v;
  return o;
};
/** Ninja with the rows the event indexes: [102][9] the Emporium letters, [104] the beanstacks, [100] the doors' damage. */
const NINJA = (): unknown[] => Array.from({ length: 108 }, (_, i) => (102 == i ? Array<string>(10).fill("") : []));
/** Every key quantities 0..83 read, empty, for two characters; a test overrides the keys of the quantity it checks. */
const TOME: Data = {
  StampLv: [[], [], []], StatueLevels_0: [], Cards0: {}, Cards1: [], SM_0: {}, SM_1: {}, QuestComplete_0: {}, QuestComplete_1: {},
  TaskZZ0: [[0, 0, 0]], TaskZZ1: [], AchieveReg: [], MoneyBANK: 0, OptLacc: OLA(), InventoryOrder_0: [], ItemQTY_0: [], SSprog: [],
  CauldronInfo: [[], [], [], [], []], CauldronP2W: [[], [], [], [], []], CYDeliveryBoxComplete: 0, CYDeliveryBoxStreak: 0, CYDeliveryBoxMisc: 0,
  CYTalentPoints: [0, 0, 0, 0, 0, 0], TotemInfo: [[]], WeeklyBoss: {}, Refinery: Array.from({ length: 9 }, () => [0, 0]), Atoms: [],
  // every map's kills at 0: the kills left to advance are the whole requirement MapDetails[map][0][0]
  KLA_0: (MapDetails as unknown as unknown[][][]).map((m) => [Number(m[0][0])]),
  KLA_1: (MapDetails as unknown as unknown[][][]).map((m) => [Number(m[0][0])]),
  // and every key quantities 42..83 read
  Tower: Array<number>(27).fill(0), ChestOrder: [], ChestQuantity: [], GreenStacks: [], Rift: [0], Pets: [], PetsStored: [],
  Cooking: Array.from({ length: 10 }, () => Array<number>(9).fill(0)), Breeding: Array.from({ length: 27 }, () => []), Lab: Array.from({ length: 16 }, () => []),
  FamValColosseumHighscores: [], FamValMinigameHiscores: [], Boats: [], GamingSprout: Array.from({ length: 33 }, () => [0, 0]), Sailing: [[], [0], [], []],
  Captains: Array.from({ length: 20 }, () => [0, 0, 0, 0]), Gaming: Array<number>(9).fill(0), FarmCrop: {}, Ninja: NINJA(), Summon: [[], [], [], [], []],
  PrayOwned: [], FarmRank: [[]], ArcadeUpg: [], Holes: Array.from({ length: 12 }, () => []),
};
const ctxOf = (data: Data, o: { seeds?: Seeds; real?: string[]; trace?: boolean } = {}) =>
  synth({ ...TOME, ...data }, { chars: 2, seeds: o.seeds, real: ["DNSM.TomeQTY", ...(o.real ?? [])], trace: o.trace });
const q = (i: number, data: Data = {}, o: { seeds?: Seeds; real?: string[] } = {}) => tomeQty(ctxOf(data, o), i);

describe("the TomeQTY event on a synthetic envelope (runs in CI)", () => {
  it("[0] the stamp page's total @9085872: every StampLevel of the three tabs (a tab may be a {i, length} map)", () =>
    expect(q(0, { StampLv: [[1, 2], { 0: 3, 1: 4, length: 2 }, [5]] })).toBe(15));
  it("[1] the current character's StatueLevels[g][0] @5740553", () => expect(q(1, { StatueLevels_0: [[3, 0], [4, 9]] })).toBe(7));
  it("[2] CardLv of each Cards[0] key that is a card of the card info map @5741317", () =>
    expect(q(2, { Cards0: { Boss2C: 5, NotACard: 9 } }, { seeds: { 'RunCodeOfTypeXforThingY["CardLv","Boss2C"]': 3, 'RunCodeOfTypeXforThingY["CardLv","NotACard"]': 100 } })).toBe(3));
  it("[3] per talent, the best SkillLevelsMAX of the account (above 0) @5742014", () =>
    expect(q(3, { SM_0: { 0: 5, 2: 7 }, SM_1: { 0: 9, 3: -1 } })).toBe(16));
  it("[4] the SceneNPCquestOrder quests some character has done @5742562", () => {
    const [a, b] = SceneNPCquestOrder as unknown as string[];
    expect(q(4, { QuestComplete_0: { [a]: 1, [b]: 0 }, QuestComplete_1: { [b]: 1, NotAQuest: 1 } })).toBe(2);
  });
  it("[5] every character's Lv0[0] @5742904", () => expect(q(5, { Lv0_0: [100], Lv0_1: [50] })).toBe(150));
  it("[6] Tasks[1][i][0..7] @5743830", () => expect(q(6, { TaskZZ1: [[1, 2, 3, 4, 5, 6, 7, 8, 100], [1]] })).toBe(37));
  it("[7] the achievements done (AchieveReg -1) @5744052", () => expect(q(7, { AchieveReg: [-1, 0, -1, 1] })).toBe(2));
  it("[8] OptionsListAccount[198] raised to MoneyBANK first (@5739649, in memory) @5744117", () => {
    expect(q(8, { MoneyBANK: 50, OptLacc: OLA({ 198: 20 }) })).toBe(50);
    expect(q(8, { MoneyBANK: 10, OptLacc: OLA({ 198: 20 }) })).toBe(20);
  });
  it("[9] OptionsListAccount[208] raised to the current inventory's Grasslands1 (@5744526, in memory) @5744606", () => {
    const inv = { InventoryOrder_0: ["Grasslands1", "Blank", "Grasslands1"], ItemQTY_0: [5, 1, 7] };
    expect(q(9, { ...inv, OptLacc: OLA({ 208: 3 }) })).toBe(12);
    expect(q(9, { ...inv, OptLacc: OLA({ 208: 100 }) })).toBe(100);
  });
  it("[10] [21] [107] the Cards[1] names that start with Trophy, else Obol, else EquipmentNametag @5745136", () => {
    const d = { Cards1: ["Trophy1", "Obol2", "EquipmentNametag3", "xTrophy", "ObolTrophy"] };
    expect([q(10, d), q(21, d), q(107, d)]).toEqual([1, 2, 1]);
  });
  it("[11] every character's Lv0[1..21], each at least 0 @5745686", () =>
    expect(q(11, { Lv0_0: [100, 3, -1, ...Array<number>(18).fill(0), 2, 50], Lv0_1: [50, 4] })).toBe(9));
  it("[12] [14] [20] [25] [27..29] [31..36] the records of OptionsListAccount", () => {
    const at = { 12: 201, 14: 172, 20: 203, 25: 199, 27: 204, 28: 205, 29: 206, 31: 211, 32: 212, 33: 213, 34: 214, 35: 215, 36: 209 };
    const d = { OptLacc: OLA(Object.fromEntries(Object.values(at).map((o) => [o, o + 0.5]))) };
    const c = ctxOf(d);
    for (const [i, o] of Object.entries(at)) expect(tomeQty(c, Number(i)), `TomeQTY[${i}]`).toBe(o + 0.5);
  });
  it("[13] Tasks[0][0][2] @5745854", () => expect(q(13, { TaskZZ0: [[0, 0, 42]] })).toBe(42));
  it("[15] TotalTalentPoints(six 0s)[5], the star tab @4387868", () => {
    const seeds: Seeds = {
      "GetTalentNumber[1,275]": 2.6, "GetTalentNumber[1,8]": 1, "GetTalentNumber[1,622]": 2, "GetTalentNumber[1,17]": 3, 'DNSM.FamBonusQTYs["64"]': 4,
      'StampBonusOfTypeX["TalentS"]': 5, "GuildBonuses[11]": 6.7, "FlurboShop[1]": 7, 'RunCodeOfTypeXforThingY["CardLv","w4b2"]': 20,
      'RunCodeOfTypeXforThingY["CardLv","Boss2C"]': 1, 'RunCodeOfTypeXforThingY["CardLv","fallEvent1"]': 30, 'Labb["SigilBonus","Blank",9,0]': 8,
      "AchieveStatus[212]": 1, "AchieveStatus[289]": 1, "AchieveStatus[305]": 0, 'Breeding["ShinyBonusS","Nah",14,-1]': 9.5, 'GetBribeBonus["32"]': 10,
      'RandomEvent["FractalIslandBonus",5,999]': 0.5, 'Summoning["VaultUpgBonus",53,0]': 11, "Companions[20]": 12,
    };
    // floor(100 - 1 + (-3 + 45 + round 2.6) + 1 + 13 + 4 + 2 + 5 + 3 + floor 6.7 + 7 + min(100, 50) + min(15, 100) + min(120, 100) + 8 + 10 + 20 + 0 + 9.5 + 10 + 50 + 11 + 12)
    expect(q(15, { Lv0_0: [100, 1, 2, 3, 4, 5, 6, 7, 8, 9], CYTalentPoints: [0, 0, 0, 0, 0, 13] }, { seeds, real: ["TotalTalentPoints"] })).toBe(480);
  });
  it("[16] 1 / OptionsListAccount[202], the record raised to ArbitraryCode(\"CrystalSpawn\") first (@5740104, in memory) @5746509", () => {
    expect(q(16, { OptLacc: OLA({ 202: 0.25 }) })).toBe(4);
    const seeds: Seeds = {
      'Summoning["EventShopOwned",42,0]': 1, "GetTalentNumber[1,26]": 100, 'DNSM.BoxRewards["CrystalSpawn"]': 10, "Shrine[6]": 20, "Companions[171]": 30,
      'JellyOperation["RoG_BonusQTY",8,0]': 40, "GetTalentNumber[1,619]": 0, 'StampBonusOfTypeX["CrySpawn"]': 50, "CardBonusREAL[14]": 0,
    };
    // CrystalSpawn @4054444 = (5 x 1 + (1 + 100/100)(1 + (10 + 20 + 30 + 40)/100)(1 + 0)(1 + 50/100)(1 + 0)) / 2000 = 11 / 2000
    expect(q(16, { OptLacc: OLA({ 202: 0.001 }) }, { seeds, real: ["ArbitraryCode"] })).toBeCloseTo(2000 / 11, 9);
  });
  it("[17] the dungeon rank @5746624: the first b with OptionsListAccount[71] below RANDOlist[29][b], else 1 (ActorEvents_498 @9245621)", () => {
    const steps = (RANDOlist as unknown as unknown[][])[29].map(Number);
    expect(q(17, { OptLacc: OLA({ 71: steps[3] }) })).toBe(4);
    expect(q(17, { OptLacc: OLA({ 71: steps[steps.length - 1] + 1 }) })).toBe(1);
  });
  it("[18] OptionsListAccount[200] as saved, under an assumed: leaf (the live Drop Rate it is raised to @5739896 is not ported)", () => {
    const c = ctxOf({ OptLacc: OLA({ 200: 12 }) }, { trace: true });
    expect(tomeQty(c, 18)).toBe(12);
    const notes = (n: TraceNode): string[] => [n.note ?? "", ...n.children.flatMap(notes)];
    expect(notes(c.trace!).some((n) => n.startsWith("assumed:") && /Drop Rate/.test(n))).toBe(true);
  });
  it("[19] the constellations done (StarSignProg[g][1] == 1) @5747053", () => expect(q(19, { SSprog: [[0, 1], [0, 0], [0, "1"]] })).toBe(2));
  it("[22] [23] CauldronInfo[0..3] and [4], every entry (a list may be a {i, length} map) @5748082", () => {
    const d = { CauldronInfo: [[1, 2], { 0: 3, length: 1 }, [4], [5], { 0: 7, 1: 8, length: 2 }] };
    expect([q(22, d), q(23, d)]).toEqual([15, 15]);
  });
  it("[24] 1 + CauldronP2W[4][1 + 2g] for g below ceil(length / 2) @5748572", () => expect(q(24, { CauldronP2W: [[], [], [], [], [0, 5, 0, 7, 0]] })).toBe(15));
  it("[26] the delivery boxes, each rounded @5748739", () =>
    expect(q(26, { CYDeliveryBoxComplete: 1.4, CYDeliveryBoxStreak: 2.5, CYDeliveryBoxMisc: 3.6 })).toBe(8));
  it("[30] 1000 - OptionsListAccount[207] @5749360", () => expect(q(30, { OptLacc: OLA({ 207: 250 }) })).toBe(750));
  it("[37] TotemInfo[0] @5750249", () => expect(q(37, { TotemInfo: [[1, 2, 3]] })).toBe(6));
  it("[38] the Death Note digits @5752210: ceil(getLOG(kills)) per mob, every character's kills summed, + the miniboss kills with Emporium 7", () => {
    const req = (MapDetails as unknown as unknown[][][]).map((m) => Number(m[0][0]));
    const kla = (k: number) => req.map((r, i) => [1 == i ? r - k : r]); // map 1 is mushG, DeathNoteMobs[0][0]
    const d = { KLA_0: kla(1000), KLA_1: kla(234), Ninja: Object.assign(NINJA(), { 105: [99999, ...Array<number>((NinjaInfo as unknown as unknown[][])[30].length - 1).fill(0)] }) };
    expect(q(38, d, { real: ["getLOG"] })).toBe(4); // getLOG(1234) = 3.09
    expect(q(38, d, { real: ["getLOG"], seeds: { 'Ninja["EmporiumBonus",7,0]': 1 } })).toBe(9); // + getLOG(99999) = 4.99
  });
  it("[39] the WeeklyBoss d_ keys at -1 @5752515", () => expect(q(39, { WeeklyBoss: { d_1: -1, d_2: 0, a_3: -1, d_4: "-1" } })).toBe(2));
  it("[40] Refinery[3..8][1] @5753055", () =>
    expect(q(40, { Refinery: [[], [], [], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 100]] })).toBe(21));
  it("[41] the Atoms @5753272", () => expect(q(41, { Atoms: [1, 2, 3] })).toBe(6));

  it("[42] the stamp actor's GenINFO[111], TowerInfo[0..26] @9087150", () =>
    expect(q(42, { Tower: [1, 2, ...Array<number>(24).fill(0), 3, 100] })).toBe(6));
  it("[43] the Critter11A of the storage, ChestQuantity at its ChestOrder index, else 0 @5753730", () => {
    expect(q(43, { ChestOrder: ["Critter1", "Critter11A"], ChestQuantity: [5, 9] })).toBe(9);
    expect(q(43, { ChestOrder: ["Critter1"], ChestQuantity: [5] })).toBe(0);
  });
  it("[44] OptionsListAccount[224] raised to DNSM.LabMFbonuses.GrStk first (@5740254, in memory): the GreenStacks, with mainframe 11 above 0", () => {
    const d = { GreenStacks: ["a", "b", "c"], OptLacc: OLA({ 224: 2 }) };
    expect(q(44, d, { seeds: { "MainframeBonus[11]": 5 } })).toBe(3);
    expect(q(44, d)).toBe(2);
    expect(q(44, { ...d, OptLacc: OLA({ 224: 7 }) }, { seeds: { "MainframeBonus[11]": 5 } })).toBe(7);
  });
  it("[45] Rift[0] @5753897", () => expect(q(45, { Rift: [37] })).toBe(37));
  it("[46] the best Pets[g][2] and PetsStored[g][2] @5754429", () =>
    expect(q(46, { Pets: [["a", 0, 5], ["b", 0, 12]], PetsStored: [["c", 0, 30], ["d", 0, "7"]] })).toBe(30));
  it("[47] [56] 1000 - OptionsListAccount[220] and [218] @5754495", () => {
    const d = { OptLacc: OLA({ 220: 120, 218: 40 }) };
    expect([q(47, d), q(56, d)]).toEqual([880, 960]);
  });
  it("[48] Cooking[g][6] + [7] + [8] of the ten kitchens @5754837", () =>
    expect(q(48, { Cooking: Array.from({ length: 10 }, (_, g) => [0, 0, 0, 0, 0, 0, g, 1, 2, 100]) })).toBe(75));
  it("[49] [51] per pet of the breeding actor's GenINFO[76], its shiny level and min(9, floor((2ndMulti - 1)^0.8) + 1) @5756149", () => {
    const groups = PetStats as unknown as unknown[][][];
    const names = groups.slice(0, 5).flatMap((g) => g.map((p) => p[0]).filter((n) => "_" != n));
    const k = names.filter((n) => n == groups[0][0][0]).length; // the pets found at (0, 0)
    const breeding: unknown[][] = Array.from({ length: 27 }, () => []);
    breeding[22] = [4]; // a shiny count past the first step (3): level 2
    breeding[2] = [0, 0, 0, 1]; // the breedability multi unlocked (GenINFO[53][0])
    breeding[13] = [99]; // 1 + ln(100^0.725): floor(3.339^0.8) + 1 = 3
    const o = { real: ["Breeding"] };
    expect([q(49, { Breeding: breeding }, o), q(51, { Breeding: breeding }, o)]).toEqual([names.length + k, names.length + 2 * k]);
    breeding[2] = [0, 0, 0, 0]; // locked: 2ndMulti is 1, each pet 1
    expect(q(51, { Breeding: breeding }, o)).toBe(names.length);
  });
  it("[50] Meals[0] @5756439", () => expect(q(50, { Meals: [[1, 2, 3]] })).toBe(6));
  it("[52] Lab[15], each at least 0 @5756671", () => expect(q(52, { Lab: [...Array.from({ length: 15 }, () => []), [1, -1, 3]] })).toBe(4));
  it("[53] FamilyValuesMap.ColosseumHighscores (FamValColosseumHighscores) @5756952", () =>
    expect(q(53, { FamValColosseumHighscores: [10, "5", 0] })).toBe(15));
  it("[54] [78] [79] OptionsListAccount[217], [221], [222]", () => {
    const c = ctxOf({ OptLacc: OLA({ 217: 1, 221: 2, 222: 3 }) });
    expect([tomeQty(c, 54), tomeQty(c, 78), tomeQty(c, 79)]).toEqual([1, 2, 3]);
  });
  it('[55] ArbitraryCode("StatueOnyxOwned") @5757119', () => expect(q(55, {}, { seeds: { 'ArbitraryCode["StatueOnyxOwned"]': 7 } })).toBe(7));
  it("[57] Boats[g][3] + [5] @5757539", () => expect(q(57, { Boats: [[0, 0, 0, 1, 0, 2], [0, 0, 0, 3, 0, 4]] })).toBe(10));
  it("[58] max(0, Divinity[25] - 10) @5757605", () => {
    const div = (v: number) => Object.assign(Array<number>(40).fill(0), { 25: v });
    expect([q(58, { Divinity: div(14) }), q(58, { Divinity: div(3) })]).toEqual([4, 0]);
  });
  it("[59] [63] GamingSprout[28][1], max(GamingSprout[32][1], OptionsListAccount[210])", () => {
    const gs = Array.from({ length: 33 }, (_, i) => (28 == i ? [0, 77] : 32 == i ? [0, 9] : [0, 0]));
    const at = (o: number) => ({ GamingSprout: gs, OptLacc: OLA({ 210: o }) });
    expect([q(59, at(0)), q(63, at(4)), q(63, at(40))]).toEqual([77, 9, 40]);
  });
  it("[60] [61] Sailing[3], Sailing[1][0]", () => {
    const d = { Sailing: [[], [6, 1], [], [1, 2, 2]] };
    expect([q(60, d), q(61, d)]).toEqual([5, 6]);
  });
  it("[62] the best Captains[g][3] of the first 20", () =>
    expect(q(62, { Captains: Array.from({ length: 21 }, (_, g) => [0, 0, 0, 19 == g ? 25 : 20 == g ? 99 : g]) })).toBe(25));
  it("[64] [66] Gaming[8], Gaming[0]", () => {
    const d = { Gaming: [5, 0, 0, 0, 0, 0, 0, 0, 3] };
    expect([q(64, d), q(66, d)]).toEqual([3, 5]);
  });
  it("[65] Cards[1].length", () => expect(q(65, { Cards1: ["a", "b", "c"] })).toBe(3));
  it("[67] 2^OptionsListAccount[219]", () => expect(q(67, { OptLacc: OLA({ 219: 5 }) })).toBe(32));
  it("[68] the FarmCrop keys (D.mapCount)", () => expect(q(68, { FarmCrop: { 0: 1, 3: 0, 7: 2 } })).toBe(3));
  it("[69] [74] Ninja[104], the length of Ninja[102][9]", () => {
    const ninja = Object.assign(NINJA(), { 104: [1, 2, 3], 102: [0, 0, 0, 0, 0, 0, 0, 0, 0, "abcd"] });
    expect([q(69, { Ninja: ninja }), q(74, { Ninja: ninja })]).toEqual([6, 4]);
  });
  it("[70] [73] Summon[0], Summon[4][g] times 1, 3, 12, 60... (x (g + 3) each step)", () => {
    const d = { Summon: [[1, 2], [], [], [], [1, 1, 1, 1, 0, 0, 0, 0, 2, 7]] };
    expect([q(70, d), q(73, d)]).toEqual([3, 1 + 3 + 12 + 60 + 2 * 1814400]);
  });
  it("[71] the Summoning actor's GenINFO[143][9] @11662944: the Pet wins, the wins per DeathNoteMobs list, + OptionsListAccount[319]", () => {
    const mobs = DeathNoteMobs as unknown as unknown[][];
    const m = mobs[2][1];
    const lists = mobs.filter((l) => l.includes(m)).length;
    expect(q(71, { Summon: [[], ["Pet1", "Pet4", m, "Nothing"], [], [], []], OptLacc: OLA({ 319: 5 }) })).toBe(2 + lists + 5);
  });
  it('[72] 12 x OptionsListAccount[232] when above 0, else Ninja("FloorsUnlocked"), min(12, the summon actor\'s GenINFO[87]) @11705691', () => {
    const ninja = Object.assign(NINJA(), { 100: [1, 150, 800] }); // the first three doors down: floor 4
    expect(q(72, { Ninja: ninja }, { real: ["Ninja"] })).toBe(4);
    expect(q(72, { Ninja: ninja, OptLacc: OLA({ 232: 3 }) }, { real: ["Ninja"] })).toBe(36);
    // DoorMaxHP is 0 while OptionsListAccount[231] < [232]: every door is down, floor min(12, 13)
    expect(Ninja(ctxOf({ OptLacc: OLA({ 232: 1 }) }, { real: ["Ninja"] }), "FloorsUnlocked", 0, 0)).toBe(12);
  });
  it("[75] FamilyValuesMap.MinigameHiscores[0..3] + OptionsListAccount[99]", () =>
    expect(q(75, { FamValMinigameHiscores: [1, 2, 3, 4, 100], OptLacc: OLA({ 99: 10 }) })).toBe(20));
  it("[76] PrayersUnlocked (PrayOwned)", () => expect(q(76, { PrayOwned: [1, 2, 3] })).toBe(6));
  it("[77] FarmRank[0]", () => expect(q(77, { FarmRank: [[1, 2, 3]] })).toBe(6));
  it("[80] ArcadeUpg", () => expect(q(80, { ArcadeUpg: [1, 2, 3] })).toBe(6));
  it('[81] min(1500, Summoning("VaultUpgBonus", 57))', () => {
    expect(q(81, {}, { seeds: { 'Summoning["VaultUpgBonus",57,0]': 2000 } })).toBe(1500);
    expect(q(81, {}, { seeds: { 'Summoning["VaultUpgBonus",57,0]': 800 } })).toBe(800);
  });
  it("[82] [83] Holes[11][65..70], ceil(getLOG(Holes[9][g]))", () => {
    const holes: unknown[] = Array.from({ length: 12 }, () => []);
    holes[11] = Object.assign(Array<number>(71).fill(0), { 64: 100, 65: 1, 66: 2, 67: 3, 68: 4, 69: 5, 70: 6 });
    holes[9] = [12345, 5, 0]; // ceil 4.09 + ceil 0.70 + 0
    expect([q(82, { Holes: holes }), q(83, { Holes: holes }, { real: ["getLOG"] })]).toEqual([21, 6]);
  });

  it("a quantity not ported yet throws NotPorted; the event's array is built once per state and character", () => {
    const pending = [...PENDING_QTY][0];
    expect(PENDING_QTY.size).toBe(Tome.length - 85);
    const c = ctxOf({});
    expect(() => tomeQty(c, pending)).toThrow(NotPorted);
    expect(TomeQTY(c)).toBe(TomeQTY({ ...c, cache: new Map() }));
    expect(TomeQTY(c)).toHaveLength(Tome.length);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("compareTome on the 5 newest saves", () => {
  for (const p of newestSaves(goldenSaves(), 5)) {
    it(`${basename(p)}: no quantity outside TOME_KNOWN differs from the frozen computeTome`, () => {
      expect(compareTome(JSON.parse(readFileSync(p, "utf8"))).qty).toEqual([]);
    });
  }
});
