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
