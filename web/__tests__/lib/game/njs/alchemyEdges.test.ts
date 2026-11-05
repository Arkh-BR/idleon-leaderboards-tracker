// Task 6 (Damage plan): the edges of the sub-cases this task ported, on a real save with one edit each (skipped without saves). A describe body
// never reads a save: each test builds its state inside `it`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES } from "../support/arkhOracle";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { JewelDesc, LabMainBonus, Spelunky } from "@/lib/game/data";
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
const seed = (c: Ctx, name: string, args: (string | number)[], v: number) => c.cache.set(`0|${MAP}|${name}${JSON.stringify(args)}`, v);

describe.skipIf(GOLDEN_SAVES.length === 0)("Task 6 edges", () => {
  it("Log2 is ln(max(a, 1)) / ln 2: 0 below 1, never negative", () => {
    const c = ctxWith();
    expect(Log2(c, 0.5)).toBe(0);
    expect(Log2(c, 0)).toBe(0);
    expect(Log2(c, 8)).toBeCloseTo(3, 12);
  });

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

  it("MainframeBonus(11) is (LabMainBonus[11][5] + jewel 117) times the GreenStacks the account has (TalentCalc(-7) @4511431)", () => {
    const row5 = Number((LabMainBonus as unknown as unknown[][])[11][5]);
    const stacks = (n: number) =>
      ctxWith((d) => {
        d.GreenStacks = Array.from({ length: n }, (_, i) => `Item${i}`);
      });
    const one = (n: number) => {
      const c = stacks(n);
      seed(c, "MainframeBonus", [117], 7);
      return MainframeBonus(c, 11);
    };
    expect(one(3)).toBe((row5 + 7) * 3);
    expect(one(0)).toBe(0);
  });

  it("MainframeBonus(0) is (LabMainBonus[0][5] + jewel 101) times the pets found", () => {
    const c = ctxWith();
    seed(c, "MainframeBonus", [101], 3);
    seed(c, "Breeding", ["TotPetsFound", "0", 0, 0], 10);
    expect(MainframeBonus(c, 0)).toBe((Number((LabMainBonus as unknown as unknown[][])[0][5]) + 3) * 10);
  });

  it("MainframeBonus(110) is the jewel times bonus 8, doubled when jewels 107, 108 and 109 are all above 0", () => {
    const owned = (edit: (c: Ctx) => void) => {
      const c = ctxWith((d) => {
        const lab = get(d, "Lab");
        (lab[14] as number[])[10] = 1;
        d.Lab = lab;
      });
      seed(c, "MainframeBonus", [8], 2);
      edit(c);
      return MainframeBonus(c, 110);
    };
    const j = Number((JewelDesc as unknown as unknown[][])[10][12]);
    expect(owned((c) => [107, 108, 109].forEach((n) => seed(c, "MainframeBonus", [n], 1)))).toBe(2 * j * 2);
    expect(owned((c) => [[107, 1], [108, 1], [109, 0]].forEach(([n, v]) => seed(c, "MainframeBonus", [n], v)))).toBe(j * 2);
  });
});
