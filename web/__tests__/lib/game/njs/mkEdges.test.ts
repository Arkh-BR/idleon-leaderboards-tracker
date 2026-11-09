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
    expect(() => GetBuffBonuses(synth({ CharacterClass_0: 4, BuffsActive_0: [] }), 40, 2)).toThrow(NotPorted);
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
