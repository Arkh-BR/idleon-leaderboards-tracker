// Task 2 (Multikill plan): the edges of the sub-cases this task ported for WorkbenchStuff("MultiKillTOTAL"), on a synthetic envelope (no real save, so CI runs them): the branches no
// real save reaches and every gate at its limit. Only the keys a test sets are in the save; every other block is answered from the Ctx cache (`seed`).
import { describe, it, expect } from "vitest";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { InvalidSaveValue, NotPorted } from "@/lib/game/errors";
import { MONSTERS, RandoListo2 } from "@/lib/game/data";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { Holes } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";

type Data = Record<string, unknown>;
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
const synth = (data: Data, o: { map?: number } = {}): Ctx =>
  makeCtx(
    buildGameState({
      data,
      charNames: ["c0"],
      companion: null,
      guildData: {},
      serverVars: null,
      tournament: {},
      accountCreateTime: 1,
      lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map: o.map ?? 251 }
  );
const ola = (at: Record<number, unknown>) => Object.assign(Array<unknown>(700).fill(0), at);

describe("GetBuffBonuses 45, 46 and 469 (@4279371)", () => {
  /** Character of class `cls` with the buffs `on` running; the talent numbers 45 (curve 1) and `n` (curve 2) as given. */
  const buff = (n: number, cls: unknown, on: number[], t45 = 3, tn = 7) => {
    const c = synth({ CharacterClass_0: cls, BuffsActive_0: on.map((id) => [id, 100, 100]) });
    seed(c, "GetTalentNumber", [1, 45], t45);
    seed(c, "GetTalentNumber", [2, n], tn);
    return GetBuffBonuses(c, n, 2);
  };
  it("46 is its talent number on the classes 4 and 5, while 46 and 45 both run", () => {
    expect(buff(46, 4, [46, 45])).toBe(7);
    expect(buff(46, 5, [46, 45])).toBe(7);
  });
  it("the class is read loosely (`4 == CharacterClass`)", () => {
    expect(buff(46, "4", [46, 45])).toBe(7);
  });
  it("46 is 0 on any other class", () => {
    expect(buff(46, 3, [46, 45])).toBe(0);
    expect(buff(46, 6, [46, 45])).toBe(0);
  });
  it("46 is 0 without its own buff, without the buff 45, or while 45's talent number is 0", () => {
    expect(buff(46, 4, [45])).toBe(0);
    expect(buff(46, 4, [46])).toBe(0);
    expect(buff(46, 4, [46, 45], 0)).toBe(0);
  });
  it("469 is the generic rule: its talent number on curve 2 while it runs, on any class", () => {
    expect(buff(469, 3, [469])).toBe(7);
    expect(buff(469, 3, [])).toBe(0);
  });
  it("45 is the generic rule, on the curve asked", () => {
    const c = synth({ CharacterClass_0: 4, BuffsActive_0: [[45, 100, 100]] });
    seed(c, "GetTalentNumber", [1, 45], 3);
    expect(GetBuffBonuses(c, 45, 1)).toBe(3);
  });
  it("another buff stays not ported", () => {
    expect(() => GetBuffBonuses(synth({ CharacterClass_0: 4, BuffsActive_0: [] }), 41, 2)).toThrow(NotPorted);
  });
});

describe('ArbitraryCode("StatueOnyxOwned") @4043878', () => {
  const g = (o: number, list: number[]) => ArbitraryCode(synth({ OptLacc: ola({ 69: o }), StuG: list }), "StatueOnyxOwned");
  it("counts the statues at tier 2 or above", () => {
    expect(g(2, [0, 1, 2, 3, 2])).toBe(3);
    expect(g(3, [3, 3])).toBe(2);
  });
  it("is 0 while OptionsListAccount[69] is below 2, whatever the statues are", () => {
    expect(g(1, [2, 3, 2])).toBe(0);
    expect(g(0, [2])).toBe(0);
  });
  it("counts none on an account whose statues are all below tier 2", () => {
    expect(g(2, [0, 1, 1])).toBe(0);
  });
});

describe("Holes2 Cglunko_MKbase and Cglunko_MKtier (@11057614, @11057485)", () => {
  it("are the Crystal Glunko upgrades 15 and 6: their level in OptionsListAccount times their value", () => {
    const rows = (RandoListo2 as unknown as readonly (readonly unknown[])[])[13];
    expect([rows[15], rows[6]].map(Number)).toEqual([100, 1]); // the values the two terms below are written with
    const c = synth({ OptLacc: ola({ 645: 7, 636: 3 }) });
    expect(Holes2(c, "Cglunko_MKbase", 0, 0)).toBe(7 * 100);
    expect(Holes2(c, "Cglunko_MKtier", 0, 0)).toBe(3 * 1);
  });
});

describe("WorkbenchStuff OverkillQTY: the computed page", () => {
  it("answers no page past the table's eight, which the game would turn into a NaN", () => {
    const c = synth({ Ninja: Array.from({ length: 110 }, () => Array(20).fill(0)), KLA_0: [] });
    seed(c, "WorkbenchStuff", ["DeathNoteRank", 0, 7842], 0);
    expect(() => WorkbenchStuff(c, "OverkillQTY", 8, 0)).toThrow("no Death Note page 8");
  });
});

describe('OverkillStuffs "3" (@4097281), whether the multikill applies', () => {
  const stat = (name: string, key: "MonsterHPTotal" | "Defence") => Number((MONSTERS as unknown as Record<string, Record<string, unknown>>)[name][key]);
  const tgt = "w6a1";
  const hp = stat(tgt, "MonsterHPTotal");
  const def = stat(tgt, "Defence");
  const active = (o: { map?: number; max: number; acc: number; tower?: number; target?: string; holes?: unknown; curse?: number }) => {
    const map = o.map ?? 251;
    const c = synth({ CurrentMap_0: map, AFKtarget_0: o.target ?? tgt, Tower: Object.assign(Array<number>(30).fill(0), { 2: o.tower ?? 1 }), ...(o.holes === undefined ? {} : { Holes: o.holes }) }, { map });
    seed(c, "DamageDealed", ["Max"], o.max);
    seed(c, "PlayerAccTot", [], o.acc);
    seed(c, "prayersReal", [0, 1], o.curse ?? 0);
    seed(c, "prayersReal", [7, 1], 0);
    seed(c, "prayersReal", [8, 1], 0);
    return RunCodeOfTypeXforThingY(c, "OverkillStuffs", "3");
  };
  it("is 1 with the Max at HP x E, the Death Note built and the accuracy past 1.5 x Defence", () => {
    expect(active({ max: hp * 2, acc: 1.5 * def + 1 })).toBe(1);
  });
  it("is 0 just below each gate", () => {
    expect(active({ max: hp * 2 - 1, acc: 1.5 * def + 1 })).toBe(0);
    expect(active({ max: hp * 2, acc: 1.5 * def })).toBe(0); // strictly greater
    expect(active({ max: hp * 2, acc: 1.5 * def + 1, tower: 0.5 })).toBe(0); // .5 < TowerInfo[2]
    expect(active({ max: hp * 2, acc: 1.5 * def + 1, tower: 0.51 })).toBe(1);
  });
  it("E is 5 from map 300 on", () => {
    expect(active({ map: 299, max: hp * 2, acc: 1e12 })).toBe(1);
    expect(active({ map: 300, max: hp * 5 - 1, acc: 1e12 })).toBe(0);
    expect(active({ map: 300, max: hp * 5, acc: 1e12 })).toBe(1);
  });
  it("the curses raise the HP it compares", () => {
    expect(active({ max: hp * 2, acc: 1e12, curse: 100 })).toBe(0);
    expect(active({ max: hp * 4, acc: 1e12, curse: 100 })).toBe(1);
  });
  it("the Motherlode's four targets have the Defence MonsterRespawnTimeReset leaves (@6516967), from Holes[11][1 + 2i]", () => {
    const motherlode = (target: string, acc: number, at: Record<number, number>) => active({ target, max: 1e12, acc, holes: [[], [], [], [], [], [], [], [], [], [], [], Object.assign(Array<number>(20).fill(0), at)] });
    // 2e4 x 1.8^(1 + 2) = 116640, against the table's 30000
    expect(motherlode("Motherlode", 1.5 * 116640, { 1: 2 })).toBe(0);
    expect(motherlode("Motherlode", 1.5 * 116640 + 1, { 1: 2 })).toBe(1);
    expect(motherlode("Bug14", 1.5 * 2e4 * 1.8 * 1.8 + 1, { 3: 1 })).toBe(1); // 2e4 x 1.8^2
    expect(motherlode("Bug14", 1.5 * 2e4 * 1.8 * 1.8, { 3: 1 })).toBe(0);
    expect(motherlode("MotherlodeTREE", 1.5 * 2e4 * 1.8 + 1, {})).toBe(1); // level 0: 2e4 x 1.8
    expect(motherlode("MotherlodeTREE", 1.5 * 2e4 * 1.8, {})).toBe(0);
    // the fish: i = 3, so 2e4 x (1 + 99) x 1.8 / 4 = 9e5
    expect(motherlode("MotherlodeFISH", 1.5 * 9e5, {})).toBe(0);
    expect(motherlode("MotherlodeFISH", 1.5 * 9e5 + 1, {})).toBe(1);
  });
  it("on a save whose Holes list is empty the Motherlode keeps the table's Defence (`0 != Holes.length`)", () => {
    expect(stat("Motherlode", "Defence")).toBe(30000);
    expect(active({ target: "Motherlode", max: 1e12, acc: 1.5 * 30000, holes: [] })).toBe(0);
    expect(active({ target: "Motherlode", max: 1e12, acc: 1.5 * 30000 + 1, holes: [] })).toBe(1);
  });
  it("a target the game's table does not have is refused, as the game would throw", () => {
    expect(() => active({ target: "Z", max: 1, acc: 1 })).toThrow(InvalidSaveValue);
  });
  it("Holes MotherlodeEffBase is 2e4 x (1 + 99 floor(b / 3)) x 1.8^(1 + Holes[11][1 + 2b])", () => {
    const c = synth({ Holes: Array.from({ length: 12 }, (_, i) => (i === 11 ? Object.assign(Array<number>(20).fill(0), { 7: 2 }) : [])) });
    expect(Holes(c, "MotherlodeEffBase", 3, 0)).toBeCloseTo(2e4 * 100 * Math.pow(1.8, 3), 6);
  });
});
