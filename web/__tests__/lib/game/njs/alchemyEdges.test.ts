// Task 6 (Damage plan): the edges of the sub-cases this task ported, on a real save with one edit each (skipped without saves). A describe body
// never reads a save: each test builds its state inside `it`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES } from "../support/arkhOracle";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { JewelDesc, LabMainBonus, NinjaInfo, Spelunky } from "@/lib/game/data";
import { Log2 } from "@/lib/game/njs/Log2";
import { Labb } from "@/lib/game/njs/Labb";
import { Bubbastuff } from "@/lib/game/njs/Bubbastuff";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";

const MAP = 251;
/** The newest real save, its envelope edited by `edit` (a key's value may be a JSON string in the envelope: `get` parses it). */
function ctxWith(edit: (data: Record<string, unknown>) => void = () => {}): Ctx {
  const env = JSON.parse(readFileSync(GOLDEN_SAVES[GOLDEN_SAVES.length - 1], "utf8")) as GameEnvelope;
  edit(env.data as Record<string, unknown>);
  return makeCtx(buildGameState(env), { player: 0, map: MAP });
}
const get = (d: Record<string, unknown>, key: string): unknown[] => (typeof d[key] === "string" ? JSON.parse(d[key] as string) : (d[key] as unknown[]));
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`${c.player}|${c.map}|${name}${JSON.stringify(args)}`, v);
/** A synthetic envelope (no real save, so CI runs these): only the keys a test sets; every other read is seeded in the Ctx cache. */
const synth = (data: Record<string, unknown>): Ctx =>
  makeCtx(buildGameState({ data, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 } as unknown as GameEnvelope), { player: 0, map: 0 });
const emporium = (c: Ctx, owned: number) => [8, 9, 10, 11].forEach((n) => seed(c, "Ninja", ["EmporiumBonus", n, 0], owned));
const row = (list: unknown, i: number, j: number) => Number((list as unknown[][])[i][j]);

describe("Task 6 edges on a synthetic save (run in CI)", () => {
  it("Log2 is ln(max(a, 1)) / ln 2: 0 below 1, never negative", () => {
    const c = synth({});
    expect(Log2(c, 0.5)).toBe(0);
    expect(Log2(c, 0)).toBe(0);
    expect(Log2(c, 8)).toBeCloseTo(3, 12);
  });

  it("MainframeBonus(15) and (17) are the row's value [5] plus jewel 118 / 120, on the rows the Emporium items 9 and 11 push (NinjaInfo[26], [28])", () => {
    const c = synth({});
    emporium(c, 1); // LabMainBonus grows to 18 rows: 14, then NinjaInfo[25..28]
    seed(c, "MainframeBonus", [118], 3);
    seed(c, "MainframeBonus", [120], 5);
    expect(MainframeBonus(c, 15)).toBe(row(NinjaInfo, 26, 5) + 3);
    expect(MainframeBonus(c, 17)).toBe(row(NinjaInfo, 28, 5) + 5);
  });

  it("MainframeBonus(118) is JewelDesc[18][12] times bonus 8 once the jewel is owned", () => {
    const c = synth({ Lab: [[], [], [], [], [], [], [], [], [], [], [], [], [], [], Array<number>(25).fill(0).map((_, i) => (i === 18 ? 1 : 0))] });
    emporium(c, 0);
    seed(c, "MainframeBonus", [8], 2);
    expect(MainframeBonus(c, 118)).toBe(row(JewelDesc, 18, 12) * 2);
  });

  it("MainframeBonus(0) is (LabMainBonus[0][5] + jewel 101) times the pets found", () => {
    const c = synth({});
    emporium(c, 0);
    seed(c, "MainframeBonus", [101], 3);
    seed(c, "Breeding", ["TotPetsFound", "0", 0, 0], 10);
    expect(MainframeBonus(c, 0)).toBe((row(LabMainBonus, 0, 5) + 3) * 10);
  });

  it("MainframeBonus(11) is (LabMainBonus[11][5] + jewel 117) times the GreenStacks the account has (TalentCalc(-7) @4511431)", () => {
    const at = (n: number) => {
      const c = synth({ GreenStacks: Array.from({ length: n }, (_, i) => `Item${i}`) });
      emporium(c, 0);
      seed(c, "MainframeBonus", [117], 7);
      return MainframeBonus(c, 11);
    };
    expect(at(3)).toBe((row(LabMainBonus, 11, 5) + 7) * 3);
    expect(at(0)).toBe(0);
  });

  it("MainframeBonus(110) is the jewel times bonus 8, doubled when jewels 107, 108 and 109 are all above 0", () => {
    const owned = (three: number) => {
      const c = synth({ Lab: [[], [], [], [], [], [], [], [], [], [], [], [], [], [], Array<number>(25).fill(0).map((_, i) => (i === 10 ? 1 : 0))] });
      emporium(c, 0);
      seed(c, "MainframeBonus", [8], 2);
      [[107, 1], [108, 1], [109, three]].forEach(([n, v]) => seed(c, "MainframeBonus", [n], v));
      return MainframeBonus(c, 110);
    };
    const j = row(JewelDesc, 10, 12);
    expect(owned(1)).toBe(2 * j * 2);
    expect(owned(0)).toBe(j * 2);
  });

  it("Bubbastuff BubbaRoG_Bonuses(b) = (1 + 20% per milestone) x (1 + Companion 51) x Spelunky[33][b] x ceil((Bubba[1][3] - (b - 1)) / 7), b = 4 and 1", () => {
    const c = synth({ Bubba: [[], [0, 0, 0, 20, 0, 0, 0, 0, 12]] }); // Bubba[1][8] = 12: milestones 1, 3, 6, 9, 11 owned, +100%
    seed(c, "Companions", [51], 0.5);
    expect(Bubbastuff(c, "BubbaRoG_Bonuses", 4, 0)).toBeCloseTo(2 * 1.5 * row(Spelunky, 33, 4) * Math.ceil((20 - 3) / 7), 9);
    expect(Bubbastuff(c, "BubbaRoG_Bonuses", 1, 0)).toBeCloseTo(2 * 1.5 * row(Spelunky, 33, 1) * Math.ceil(20 / 7), 9);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("Task 6 edges", () => {

  it("Labb TotalGreenSigils counts the sigils at tier 4 or more (purple, tier 3, is not green)", () => {
    const tiers = [4, 5, 4, 3, 3.9, 4, 2, -1, 4, ...Array<number>(15).fill(-1)];
    const c = ctxWith((d) => {
      const p2w = get(d, "CauldronP2W");
      tiers.forEach((t, f) => ((p2w[4] as number[])[1 + 2 * f] = t));
      d.CauldronP2W = p2w;
    });
    expect(Labb(c, "TotalGreenSigils", "0", 0, 0)).toBe(5);
    expect(Labb(c, "TotalPurpleSigils", "0", 0, 0)).toBe(7); // 4, 5, 4, 3, 4, 4... = every tier >= 3 (3.9 included)
  });

  it("Bubbastuff MegafleshOwned: a milestone is owned when Bubba[1][8] is past it; the 11th counts each one past it", () => {
    const at = (n: number) =>
      ctxWith((d) => {
        const bubba = get(d, "Bubba");
        (bubba[1] as number[])[8] = n;
        d.Bubba = bubba;
      });
    const c12 = at(12);
    expect([1, 3, 6, 9, 11, 5].map((b) => Bubbastuff(c12, "MegafleshOwned", b, 0))).toEqual([1, 1, 1, 1, 1, 1]);
    expect(Bubbastuff(c12, "MegafleshOwned", 13, 0)).toBe(0);
    expect(Bubbastuff(at(15), "MegafleshOwned", 11, 0)).toBe(4); // 15 - 11
    expect(Bubbastuff(at(11), "MegafleshOwned", 11, 0)).toBe(0); // 11 > 11 is false
    expect(Bubbastuff(at(11), "MegafleshOwned", 9, 0)).toBe(1);
  });

  it("Bubbastuff BubbaRoG_Bonuses: (1 + 20% per milestone) x (1 + Companion 51) x Spelunky[33][b] x ceil((Bubba[1][3] - (b - 1)) / 7)", () => {
    const c = ctxWith((d) => {
      const bubba = get(d, "Bubba");
      (bubba[1] as number[])[8] = 12; // milestones 1, 3, 6, 9 and 11 owned: +100%
      (bubba[1] as number[])[3] = 20;
      d.Bubba = bubba;
    });
    seed(c, "Companions", [51], 0.5);
    const per = Number((Spelunky as unknown as unknown[][])[33][4]);
    expect(Bubbastuff(c, "BubbaRoG_Bonuses", 4, 0)).toBeCloseTo(2 * 1.5 * per * Math.ceil((20 - 3) / 7), 9);
    // a negative tier count is floored at 0
    const low = ctxWith((d) => {
      const bubba = get(d, "Bubba");
      (bubba[1] as number[])[3] = -30;
      d.Bubba = bubba;
    });
    seed(low, "Companions", [51], 0);
    expect(Bubbastuff(low, "BubbaRoG_Bonuses", 4, 0)).toBe(0);
  });



});
