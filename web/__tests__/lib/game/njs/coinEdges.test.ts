// Task 2 (Coin plan): the edges of the sub-cases this task ported for ArbitraryCode("MonsterCash"), on a synthetic envelope (no real save, so CI runs them): the branches no
// real save reaches, and every factor at a value of its own. Only the keys a test sets are in the save; every other block is answered from the Ctx cache (`seed`).
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { InvalidSaveValue, NotPorted } from "@/lib/game/errors";
import { ArcaneUpg, ArtifactInfo, CardStuff, HolesInfo, JewelDesc, LabMainBonus, MapAFKtarget, MapDetails, MONSTERS } from "@/lib/game/data";
import { migrate } from "@/lib/game/migrations";
import { getLOG } from "@/lib/game/njs/getLOG";
import { Stuff2 } from "@/lib/game/njs/Stuff2";
import { Holes } from "@/lib/game/njs/Holes";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { Sailing } from "@/lib/game/njs/Sailing";
import { Thingies } from "@/lib/game/njs/Thingies";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { FarmingStuffs } from "@/lib/game/njs/FarmingStuffs";
import { TalentCalc } from "@/lib/game/njs/TalentCalc";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { RiftStuff } from "@/lib/game/njs/RiftStuff";

type Data = Record<string, unknown>;
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
const synth = (data: Data, o: { chars?: number; map?: number } = {}): Ctx =>
  makeCtx(
    buildGameState({
      data,
      charNames: Array.from({ length: o.chars ?? 1 }, (_, i) => `c${i}`),
      companion: null,
      guildData: {},
      serverVars: null,
      tournament: {},
      accountCreateTime: 1,
      lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map: o.map ?? 301 }
  );
const ola = (at: Record<number, unknown>) => Object.assign(Array<unknown>(700).fill(0), at);
/** Holes with 30 rows of 100 zeros, then the rows `at` gives. */
const holes = (at: Record<number, Record<number, number>> = {}) => Array.from({ length: 30 }, (_, i) => Object.assign(Array<number>(100).fill(0), at[i] ?? {}));
const traced = (c: Ctx): Ctx => ({ ...c, trace: makeCtx(c.state, { player: c.player, map: c.map, trace: true }).trace });
const assumedOf = (c: Ctx): [string, number][] => {
  const walk = (n: TraceNode): [string, number][] => [...(n.note?.startsWith("assumed: ") ? [[n.block, n.value] as [string, number]] : []), ...n.children.flatMap(walk)];
  return walk(c.trace!);
};
const info = (row: number, i: number) => String((HolesInfo as unknown as readonly (readonly unknown[])[])[row][i]);

describe("Stuff2 CoinDropMulti and CardsCollected (synthetic, runs in CI)", () => {
  it("CoinDropMulti is 1 + Companion 38", () => {
    const c = synth({});
    seed(c, "Companions", [38], 0.75);
    expect(Stuff2(c, "CoinDropMulti", 0, 0)).toBe(1.75);
  });
  it("CardsCollected counts the CardStuff rows the account has at least one of, stated as an assumption", () => {
    const rows = (CardStuff as unknown as readonly (readonly (readonly unknown[])[])[]).flat().map((r) => String(r[0])).filter((n) => n !== "Blank");
    const c = traced(synth({ Cards0: { [rows[0]]: 1, [rows[1]]: 0, [rows[2]]: 0.5, [rows[3]]: 7, Blank: 9, notACard: 9 } }));
    expect(Stuff2(c, "CardsCollected", 0, 0)).toBe(2);
    expect(assumedOf(c)).toEqual([["DNSM.UnqCardzCol", 2]]);
  });
});

describe("Holes: the Gambit family and B_UPG 78 (synthetic, runs in CI)", () => {
  it("B_UPG 78 has no branch: e once bought, 0 before", () => {
    const at = (bought: number) => Holes(synth({ Holes: holes({ 13: { 78: bought } }) }), "B_UPG", 78, 10);
    expect(at(1)).toBe(10);
    expect(at(0)).toBe(0);
  });
  it("GambitPts b: 100 for the first challenge, 200 for the others, of v + 3 floor(v / 10) + 10 floor(v / 60)", () => {
    const c = synth({ Holes: holes({ 11: { 65: 61, 66: 61, 70: 9 } }) });
    expect(Holes(c, "GambitPts", 0, 0)).toBe(100 * (61 + 18 + 10));
    expect(Holes(c, "GambitPts", 1, 0)).toBe(200 * (61 + 18 + 10));
    expect(Holes(c, "GambitPts", 5, 0)).toBe(200 * 9);
  });
  it("GambitPts 99 sums the six challenges, 777 is that times the multi", () => {
    const c = synth({});
    [1, 2, 3, 4, 5, 6].forEach((v, b) => seed(c, "Holes", ["GambitPts", b, 0], v));
    seed(c, "Holes", ["GambitPTSmulti", 0, 0], 1.5);
    expect(Holes(c, "GambitPts", 99, 0)).toBe(21);
    expect(Holes(c, "GambitPts", 777, 0)).toBe(31.5);
  });
  it("GambitPTSmulti is 1 + the sum of its seven terms / 100, each at its own value", () => {
    const terms: [string, (string | number)[], number][] = [
      ["Holes", ["MeasurementBonusTOTAL", 13, 0], 1], ["Holes", ["StudyBolaiaBonuses", 13, 0], 2], ["Holes", ["B_UPG", 78, 10], 4], ["Holes", ["MonumentROGbonuses", 2, 7], 8],
      ["Holes", ["JarCollectibleBonus", 23, 0], 16], ["Holes", ["JarCollectibleBonus", 30, 0], 32], ["ArcaneType", ["ArcaneUpgBonus", 47, 0], 64],
    ];
    const c = synth({});
    for (const [n, a, v] of terms) seed(c, n, a, v);
    expect(Holes(c, "GambitPTSmulti", 0, 0)).toBeCloseTo(1 + 127 / 100, 12);
    for (const [n, a, v] of terms) {
      const d = synth({});
      for (const [n2, a2, v2] of terms) seed(d, n2, a2, a2 === a ? v2 + 100 : v2);
      expect(Holes(d, "GambitPTSmulti", 0, 0), `${n}${JSON.stringify(a)}`).toBeCloseTo(1 + (127 + 100) / 100, 12);
      expect(v).toBeGreaterThan(0);
    }
  });
  it("GambitPtsREQ is 2000 + 1000 (b + 1)(1 + b / 5) 1.26^b", () => {
    expect(Holes(synth({}), "GambitPtsREQ", 7, 0)).toBeCloseTo(2e3 + 1e3 * 8 * (1 + 7 / 5) * Math.pow(1.26, 7), 9);
    expect(Holes(synth({}), "GambitPtsREQ", 0, 0)).toBe(3e3);
  });
  it("GambitBonuses 7: 0 below the requirement, value x log10(points) from it (HolesInfo[71][7] is value|1)", () => {
    expect(info(71, 7).split("|").slice(0, 2)).toEqual(["10", "1"]);
    const at = (pts: number, req: number) => {
      const c = synth({});
      seed(c, "Holes", ["GambitPts", 777, 0], pts);
      seed(c, "Holes", ["GambitPtsREQ", 7, 0], req);
      return [Holes(c, "GambitBonuses", 7, 0), getLOG(c, pts)];
    };
    expect(at(999, 1000)[0]).toBe(0);
    const [v, log] = at(1000, 1000);
    expect(v).toBe(10 * log);
    expect(() => Holes(synth({}), "GambitBonuses", 3, 0)).toThrow(NotPorted);
  });
  it("StudyBolaiaBonuses 13 is Holes[26][13] x HolesInfo[70][13], 0 and the others not ported", () => {
    const c = synth({ Holes: holes({ 26: { 13: 3 } }) });
    expect(Holes(c, "StudyBolaiaBonuses", 13, 0)).toBe(3 * Number(info(70, 13)));
    expect(() => Holes(c, "StudyBolaiaBonuses", 0, 0)).toThrow(NotPorted);
    expect(() => Holes(c, "StudyBolaiaBonuses", 13, 99)).toThrow(NotPorted);
  });
  it("JarCollectibleBonus is Holes[24][b] x the field after the first | of HolesInfo[67][b] x (1 + legend 29 / 100)", () => {
    const c = synth({ Holes: holes({ 24: { 23: 4 } }) });
    seed(c, "Thingies", ["LegendPTS_bonus", 29, 0], 50);
    expect(Holes(c, "JarCollectibleBonus", 23, 0)).toBe(4 * Number(info(67, 23).split("|")[1]) * 1.5);
  });
});

describe("ArcaneType ArcaneUpgBonus 47 (synthetic, runs in CI)", () => {
  const at = (e: number) => {
    const c = synth({ Arcane: Object.assign(Array<number>(60).fill(0), { 47: 3 }) });
    seed(c, "ArcaneType", ["ArcaneUpgBonus", 39, 0], 20);
    return ArcaneType(c, "ArcaneUpgBonus", 47, e);
  };
  it("is Arcane[47] x ArcaneUpg[47][5] x (1 + upgrade 39 / 100); e == 999 answers 69.42", () => {
    expect(at(0)).toBeCloseTo(3 * Number((ArcaneUpg as unknown as readonly (readonly unknown[])[])[47][5]) * 1.2, 12);
    expect(at(999)).toBe(69.42);
  });
});

describe("Sailing ArtifactBonus 1 (synthetic, runs in CI)", () => {
  const at = (tier: number) => {
    const c = synth({ Sailing: [[], [], [], Object.assign(Array<number>(60).fill(0), { 1: tier })] });
    seed(c, "DNSM.CalcTalentMAP", ["620"], 400);
    return Sailing(c, "ArtifactBonus", 1, 0);
  };
  const base = Number((ArtifactInfo as unknown as readonly (readonly unknown[])[])[1][3]);
  it("is its base x the highest character level, 0 when not found, x the tier where its text carries it", () => {
    expect(at(0)).toBe(0);
    expect(at(1)).toBe(base * 400);
    expect(at(2)).toBe(base * 400 * 2); // ArtifactInfo[1][5] is "The_artifact's_main_bonus_is_doubled!"
  });
});

describe("Thingies FriendBonusStatz 5 and FarmingStuffs CropSCbonus 4 (synthetic, runs in CI)", () => {
  it("FriendBonusStatz 5: the friend of stat 5 sets the entry, times the extra multi", () => {
    const c = synth({ OptLacc: ola({ 476: "5,100;3,50" }) });
    seed(c, "Thingies", ["FriendBonusSlots", 0, 0], 2);
    seed(c, "Thingies", ["FriendBonusQTY", 5, 100], 7);
    seed(c, "Thingies", ["FriendBonusQTY", 3, 50], 9);
    seed(c, "Thingies", ["FriendBonusXtraMulti", 0, 0], 2);
    expect(Thingies(c, "FriendBonusStatz", 5, 0)).toBe(14);
  });
  it("CropSCbonus 4: 15 x crops x the multi once Emporium 23 is owned, else 0", () => {
    const at = (owned: number) => {
      const c = synth({ FarmCrop: { 0: 1, 1: 1, 2: 1 } });
      seed(c, "Ninja", ["EmporiumBonus", 23, 0], owned);
      seed(c, "FarmingStuffs", ["CropSCbonMulti", 0, 0], 1.5);
      return FarmingStuffs(c, "CropSCbonus", 4, 0);
    };
    expect(at(1)).toBe(15 * 3 * 1.5);
    expect(at(0)).toBe(0);
  });
});

describe("MainframeBonus 9 and 113 (synthetic, runs in CI)", () => {
  const mush = (MapAFKtarget as unknown as readonly unknown[]).indexOf("mushG");
  const total = Number((MapDetails as unknown as readonly (readonly (readonly unknown[])[])[])[mush][0][0]);
  const kla = (left: number) => Array.from({ length: mush + 1 }, () => [left]);
  const base = Number((LabMainBonus as unknown as readonly (readonly unknown[])[])[9][5]);
  const at = (kills0: number, kills1: number, jewel: number) => {
    const c = synth({ KLA_0: kla(total - kills0), KLA_1: kla(total - kills1) }, { chars: 2 });
    seed(c, "MainframeBonus", [113], jewel);
    for (let e = 0; e < 4; e++) seed(c, "Ninja", ["EmporiumBonus", 8 + e, 0], 0);
    return MainframeBonus(c, 9);
  };
  it("9 is (the base + jewel 113) x the account's mushroom kills in whole millions", () => {
    expect(at(2e6 + 5e5, 1e6, 3)).toBe((base + 3) * 3);
    expect(at(1e6 - 1, 0, 3)).toBe(0);
  });
  it("from 1e8 millions on, the kills are not rounded", () => {
    expect(at(1e14 + 5e5, 0, 0)).toBe(base * (1e14 + 5e5) / 1e6);
    expect(at(1e14 - 1, 0, 0)).toBe(base * Math.floor((1e14 - 1) / 1e6));
  });
  it("113 is the jewel's value x bonus 8 once the account owns it, else 0", () => {
    const j = Number((JewelDesc as unknown as readonly (readonly unknown[])[])[13][12]);
    const at113 = (owned: number) => {
      const c = synth({ Lab: Object.assign(Array<unknown>(20).fill([]), { 14: Object.assign(Array<number>(30).fill(0), { 13: owned }) }) });
      seed(c, "MainframeBonus", [8], 2);
      for (let e = 0; e < 4; e++) seed(c, "Ninja", ["EmporiumBonus", 8 + e, 0], 0);
      return MainframeBonus(c, 113);
    };
    expect(at113(1)).toBe(j * 2);
    expect(at113(0)).toBe(0);
  });
});

describe("TalentCalc 643 and 644, OverkillStuffs \"2\" (synthetic, runs in CI)", () => {
  const hp = (name: string) => Number((MONSTERS as unknown as Record<string, { MonsterHPTotal: unknown }>)[name].MonsterHPTotal);
  const tgt = "mushG";
  /** A character on map `map` AFK on `target` with Max damage `max` and curses (prayers 0, 7, 8). */
  const at = (map: number, target: string, max: number, curses: [number, number, number] = [0, 0, 0], data: Data = {}) => {
    const c = synth({ CurrentMap_0: map, AFKtarget_0: target, ...data }, { map });
    seed(c, "DamageDealed", ["Max"], max);
    seed(c, "prayersReal", [0, 1], curses[0]);
    seed(c, "prayersReal", [7, 1], curses[1]);
    seed(c, "prayersReal", [8, 1], curses[2]);
    return RunCodeOfTypeXforThingY(c, "OverkillStuffs", "2");
  };
  it("tier: 1 below HP x E^2, k from HP x E^k on; E is 2 below map 300", () => {
    const h = hp(tgt);
    expect(at(299, tgt, h * 4 - 1)).toBe(1);
    expect(at(299, tgt, h * 4)).toBe(2);
    expect(at(299, tgt, h * 8)).toBe(3);
  });
  it("E is 5 from map 300 on", () => {
    const h = hp(tgt);
    expect(at(300, tgt, h * 25 - 1)).toBe(1);
    expect(at(300, tgt, h * 25)).toBe(2);
    expect(at(300, tgt, h * 8)).toBe(1);
  });
  it("the ceiling is 51", () => {
    expect(at(299, tgt, Number.MAX_VALUE)).toBe(51);
  });
  it("the curses of prayers 0, 7 and 8 raise the HP, on a real monster; never on the clam (w7a6), whose HP is Clamz_HP", () => {
    const h = hp(tgt);
    expect(at(299, tgt, h * 4, [50, 30, 20])).toBe(1); // HP x 2
    expect(at(299, tgt, h * 8, [50, 30, 20])).toBe(2);
    const clam = 1e16 * Math.pow(30, 1);
    const opt = { OptLacc: ola({ 464: 1 }) };
    expect(at(306, "w7a6", clam * 25, [100, 100, 100], opt)).toBe(2);
    expect(at(306, "w7a6", clam * 24, [100, 100, 100], opt)).toBe(1);
  });
  it("uses the AFK target of the map (Ruling V): the saved target on the character's map, the map's on another", () => {
    const other = (MapAFKtarget as unknown as readonly string[])[251];
    const c = synth({ CurrentMap_0: 1, AFKtarget_0: tgt }, { map: 251 });
    seed(c, "DamageDealed", ["Max"], hp(other) * 4);
    seed(c, "prayersReal", [0, 1], 0);
    seed(c, "prayersReal", [7, 1], 0);
    seed(c, "prayersReal", [8, 1], 0);
    expect(RunCodeOfTypeXforThingY(c, "OverkillStuffs", "2")).toBe(2);
  });
  it("the Rift's monster (map 166) has the HP of the account's Rift level, cursed like the others, not the data table's", () => {
    const at65 = { Rift: [65] }; // base 1.11 + .02 + .08 + .18 = 1.39, HP 5e6 x 1.39^65, about 9.87e15, so Max 1e20 is 10132 x HP: 13.3 doublings
    expect(at(166, "riftAll", 1e20, [0, 0, 0], at65)).toBe(13);
    expect(at(166, "riftAll", 1e20, [50, 30, 20], at65)).toBe(12); // HP x 2
    expect(hp("riftAll")).toBe(1000); // the data table's value, which would give the ceiling
  });
  it("RiftStuff mobHP is 5e6 x base^level, each term of the base capped on its own", () => {
    const mob = (r: number) => RiftStuff(synth({ Rift: [r] }), "mobHP", 0);
    expect(mob(0)).toBe(5e6);
    expect(mob(5) / (5e6 * Math.pow(1.12, 5))).toBeCloseTo(1, 9); // 1.11 + .02 x 5 / 10
    expect(mob(15) / (5e6 * Math.pow(1.15, 15))).toBeCloseTo(1, 9); // 1.11 + .02 + .08 x 5 / 20
    expect(mob(43) / (5e6 * Math.pow(1.39, 43))).toBeCloseTo(1, 9); // every term at its cap from 43 on
    expect(mob(65) / (5e6 * Math.pow(1.39, 65))).toBeCloseTo(1, 9);
  });
  it("there is no check of the kind of map: a target of a town counts like any other", () => {
    const h = hp("Nothing");
    expect(at(0, "Nothing", h * 4)).toBe(2);
  });
  it("a target the game's table does not have is refused, as the game would throw", () => {
    expect(() => at(33, "Z", 1e9)).toThrow(InvalidSaveValue);
  });
  it("only b == 2 is ported", () => {
    expect(() => RunCodeOfTypeXforThingY(synth({}), "OverkillStuffs", "0")).toThrow(NotPorted);
  });
  it("TalentCalc 643 is talent 643 x the tier, 644 is talent 644 x Lv0[10] / 10", () => {
    const c = synth({ Lv0_0: Object.assign(Array<number>(20).fill(0), { 10: 35 }) });
    seed(c, "GetTalentNumber", [1, 643], 2.5);
    seed(c, "GetTalentNumber", [1, 644], 3);
    seed(c, "RunCodeOfTypeXforThingY", ["OverkillStuffs", "2"], 4);
    const t = traced(c);
    expect(TalentCalc(t, 643)).toBe(10);
    expect(assumedOf(t)).toEqual([['DNSM.CalcTalentMAP["643"]', 4]]);
    expect(TalentCalc(c, 644)).toBe(3 * 3.5);
  });
});

describe("the load step that pads KillsLeft2Advance (AddNewStuff @19916401)", () => {
  const details = MapDetails as unknown as readonly (readonly (readonly number[])[])[];
  const run = (d: Data, players = 1) => migrate(d, {}, players);
  /** A row of map `m` under its template, so the cap leaves it alone. */
  const below = (m: number) => details[m][0].map((v) => v - 1);
  it("pads every character's list to MapDetails with the rows the game's template has (MapDetails[m][0])", () => {
    const d: Data = { KLA_0: [below(0)], KLA_1: [below(0), below(1)] };
    const r = run(d, 2);
    expect(r.steps).toContain("KillsLeft2Advance padded and capped to MapDetails (AddNewStuff @19916401)");
    for (const k of ["KLA_0", "KLA_1"]) {
      const kla = d[k] as number[][];
      expect(kla).toHaveLength(details.length);
      expect(kla[details.length - 1]).toEqual(details[details.length - 1][0]);
    }
    expect((d.KLA_0 as number[][])[0]).toEqual(below(0));
    expect((d.KLA_1 as number[][])[1]).toEqual(below(1));
  });
  it("a value above the template is capped to it, a null or a nan takes it; a value below stays", () => {
    const d: Data = { KLA_0: [details[0][0].map((v) => v + 1), details[1][0].map(() => null), details[2][0].map(() => "NaN"), below(3)] };
    run(d);
    const kla = d.KLA_0 as unknown[][];
    expect(kla[0]).toEqual(details[0][0]);
    expect(kla[1]).toEqual(details[1][0]);
    expect(kla[2]).toEqual(details[2][0]);
    expect(kla[3]).toEqual(below(3));
  });
  it("gives map 17 a slot when it has none", () => {
    const d: Data = { KLA_0: Array.from({ length: 20 }, (_, m) => (m === 17 ? [] : [0])) };
    run(d);
    expect((d.KLA_0 as number[][])[17].length).toBeGreaterThan(0);
  });
  it("leaves a save without the list to the reads, and reports nothing on a complete one", () => {
    const d: Data = {};
    expect(run(d).steps.filter((s) => s.includes("KillsLeft2Advance"))).toEqual([]);
    const full: Data = { KLA_0: details.map((m) => [...m[0]]) };
    expect(run(full).steps.filter((s) => s.includes("AddNewStuff"))).toEqual([]);
  });
});
