import { describe, it, expect } from "vitest";
import { alerts, elasticities, requiredFactor, whatIf } from "@/lib/diagnose/sensitivity";
import { rankHypotheses, rankPairs, ratio, type DiagReading } from "@/lib/diagnose/hypotheses";
import { prepare } from "@/scripts/diagnose";
import { node } from "@/lib/dropRate/node";
import type { Reading } from "@/lib/readings/types";

type Flat = Record<string, number>;
const A = "R / a", B = "R / b";
const prod = (f: Flat) => f[A] * f[B];
const sqrtA = (f: Flat) => Math.sqrt(f[A]);
const rel = (x: number, y: number) => Math.abs(x / y - 1);

describe("elasticities", () => {
  it("total = a·b: d ln total / d ln a = 1", () => {
    const [ea, eb] = elasticities({ R: 6, [A]: 2, [B]: 3 }, prod, [A, B]);
    expect(ea).toMatchObject({ path: A });
    expect(ea.e).toBeCloseTo(1, 9);
    expect(eb.e).toBeCloseTo(1, 9);
  });

  it("total = cap(a) with cap(v) = v^0.5: elasticity 0.5", () => {
    expect(elasticities({ [A]: 7 }, sqrtA, [A])[0].e).toBeCloseTo(0.5, 9);
  });

  it("a leaf at 0 gets e = 0 and is flagged", () => {
    const sum = (f: Flat) => f[A] + f[B];
    expect(elasticities({ [A]: 0, [B]: 3 }, sum, [A])).toEqual([{ path: A, e: 0, zero: true }]);
  });
});

describe("requiredFactor", () => {
  const T = (f: Flat) => Math.sqrt(f[A]) * f[B];
  const flat: Flat = { [A]: 9, [B]: 2 };

  it("re-applied, the factor hits the target", () => {
    const target = T(flat) * 1.37;
    for (const p of [A, B]) {
      const f = requiredFactor(flat, T, p, target)!;
      expect(rel(T({ ...flat, [p]: flat[p] * f }), target)).toBeLessThan(1e-10);
    }
    expect(requiredFactor(flat, T, A, target)).toBeCloseTo(1.37 ** 2, 8);
  });

  it("null when no factor in [1e-3, 1e6] reaches the target", () => {
    expect(requiredFactor({ [A]: 0, [B]: 2 }, T, A, 5)).toBeNull(); // a zero leaf can't scale
    const capped = (f: Flat) => Math.min(f[A], 10);
    expect(requiredFactor({ [A]: 4 }, capped, A, 11)).toBeNull(); // above the cap
  });
});

describe("rankHypotheses", () => {
  // total = cap(x + y)·z, cap = √: x's share of the capped sum differs per reading,
  // so only x needs the same factor in both.
  const X = "R / x", Y = "R / y", Z = "R / z";
  const T = (f: Flat) => Math.sqrt(f[X] + f[Y]) * f[Z];
  const reading = (x: number, y: number, z: number, trueFactorOnX = 1.09): DiagReading => {
    const flat = { [X]: x, [Y]: y, [Z]: z };
    return { flat, total: T(flat), game: T({ ...flat, [X]: x * trueFactorOnX }), totalFromFlat: T };
  };

  it("two readings with the same missing factor on x rank x first, spread < 1e-9", () => {
    const ranked = rankHypotheses([reading(10, 5, 2), reading(3, 20, 7)], [Y, Z, X]);
    expect(ranked[0].path).toBe(X);
    expect(ranked[0].spread).toBeLessThan(1e-9);
    for (const f of ranked[0].factors) expect(f).toBeCloseTo(1.09, 9);
    expect(ranked[1].spread).toBeGreaterThan(1e-3);
  });

  it("a leaf at 0 on a reading that matches leaves that reading unconstrained (NaN)", () => {
    const off = reading(10, 5, 2);
    const ok = reading(0, 20, 7); // x = 0: ×1.09 on it changes nothing, so site = game
    const x = rankHypotheses([off, ok], [X]).find((h) => h.path === X)!;
    expect(x.factors[0]).toBeCloseTo(1.09, 9);
    expect(x.factors[1]).toBeNaN();
    expect(x.spread).toBe(0);
  });

  it("site = game: ratio 1, every required factor 1, nothing ranked as a cause", () => {
    const rs = [reading(10, 5, 2, 1), reading(3, 20, 7, 1)];
    for (const r of rs) {
      expect(ratio(r.game, r.total)).toBe(1);
      for (const p of [X, Y, Z]) expect(requiredFactor(r.flat, T, p, r.game)).toBe(1);
    }
    expect(rankHypotheses(rs, [X, Y, Z])).toEqual([]);
    expect(rankPairs(rs, [X, Y, Z])).toEqual([]);
  });

  it("a zero total that matches: no division by zero", () => {
    const zero: DiagReading = { flat: { [A]: 0, [B]: 3 }, total: 0, game: 0, totalFromFlat: prod };
    expect(ratio(0, 0)).toBe(1);
    expect(elasticities(zero.flat, prod, [A, B]).map((e) => e.e)).toEqual([0, 0]);
    expect(rankHypotheses([zero], [A, B])).toEqual([]);
  });
});

describe("rankHypotheses — display precision", () => {
  // total = (b + o)·m. Three readings match the game at 5 digits (tol 6e-5) and have
  // no o; the fourth is 1.2e-6 under the game, far below what the others can show.
  const Bp = "R / b", O = "R / o", M = "R / m";
  const T = (f: Flat) => (f[Bp] + f[O]) * f[M];
  const mk = (b: number, o: number, m: number, gap: number, tol?: number): DiagReading => {
    const flat = { [Bp]: b, [O]: o, [M]: m };
    return { flat, total: T(flat), game: T(flat) * (1 + gap), totalFromFlat: T, tol };
  };
  const readings = (tol?: number) => [mk(90, 0, 3, 0, tol), mk(120, 0, 2, 0, tol), mk(70, 0, 5, 0, tol), mk(100, 5, 2, 1.2e-6, 1e-8)];

  it("a term in every reading is not outranked by one only the differing reading has", () => {
    const ranked = rankHypotheses(readings(6e-5), [O, M, Bp]);
    const m = ranked.find((h) => h.path === M)!;
    const o = ranked.find((h) => h.path === O)!;
    expect(m.spread).toBe(0); // ×1.0000012 moves the matched readings by less than they show
    expect(o.spread).toBe(0);
    expect(m.factors.slice(0, 3).every(Number.isNaN)).toBe(true);
    expect(m.factor).toBeCloseTo(1 + 1.2e-6, 12);
    expect(ranked.indexOf(m)).toBeLessThan(ranked.indexOf(o)); // the smaller correction first
  });

  it("without a display tolerance the matched readings pin the shared term to 1", () => {
    const ranked = rankHypotheses(readings(), [O, M, Bp]);
    const m = ranked.find((h) => h.path === M)!;
    expect(m.factors.slice(0, 3)).toEqual([1, 1, 1]);
    expect(m.spread).toBeGreaterThan(1e-6);
    expect(ranked[0].path).toBe(O);
  });

  it("two differing readings that agree within their precision are consistent", () => {
    const X = "R / x", Y = "R / y";
    const S = (f: Flat) => f[X] + f[Y];
    const r = (x: number, y: number, k: number): DiagReading => {
      const flat = { [X]: x, [Y]: y };
      return { flat, total: S(flat), game: x * k + y, totalFromFlat: S, tol: 1e-4 };
    };
    const [x] = rankHypotheses([r(10, 5, 1.1), r(20, 1, 1.10001)], [X]);
    expect(x.spread).toBe(0); // ln 1.10001 − ln 1.1 ≈ 9e-6, inside 1e-4 of the totals
  });
});

describe("rankPairs (--pairs)", () => {
  it("two true factors are found by least squares on log ratios", () => {
    // total = cap(x + y + 1)·z: three readings, x ×1.2 and z ×0.9 everywhere. The +1
    // keeps the sum from being homogeneous (else x and y together could mimic z).
    const X = "R / x", Y = "R / y", Z = "R / z";
    const T = (f: Flat) => Math.sqrt(f[X] + f[Y] + 1) * f[Z];
    const rs = ([[10, 5, 2], [3, 20, 7], [8, 8, 1]] as const).map(([x, y, z]): DiagReading => {
      const flat = { [X]: x, [Y]: y, [Z]: z };
      return { flat, total: T(flat), game: T({ [X]: x * 1.2, [Y]: y, [Z]: z * 0.9 }), totalFromFlat: T };
    });
    const [best] = rankPairs(rs, [X, Y, Z]);
    expect(best.paths).toEqual([X, Z]);
    expect(best.rms).toBeLessThan(1e-9);
    expect(best.factors[0]).toBeCloseTo(1.2, 6);
    expect(best.factors[1]).toBeCloseTo(0.9, 6);
  });
});

describe("alerts", () => {
  it("flags zero leaves, neutral multipliers and runtime-only nodes", () => {
    const tree = node("R", 2, [
      node("Sum", 0, [node("a", 0), node("b", 1)], { note: "+ Σ" }),
      node("Mult", 2, [node("m1", 1, null, { fmt: "x" }), node("m2", 2, null, { fmt: "x" })], { note: "× Π" }),
      node("Buff 108", 0, null, { note: "active buff only" }),
    ]);
    const flat = { R: 2, "R / Sum": 0, "R / Sum / a": 0, "R / Sum / b": 1, "R / Mult": 2, "R / Mult / m1": 1, "R / Mult / m2": 2, "R / Buff 108": 0 };
    expect(alerts(flat, tree)).toEqual([
      { path: "R / Sum / a", kind: "zero" },
      { path: "R / Mult / m1", kind: "neutral" },
      { path: "R / Buff 108", kind: "zero" },
      { path: "R / Buff 108", kind: "runtime-note" },
    ]);
  });
});

describe("whatIf", () => {
  const env = () => ({
    data: {
      EquipOrder_0: [{ 0: "EquipmentHats1", 1: "EquipmentSword10", 2: "Blank", length: 3 }, { 0: "EquipmentTools1", length: 1 }],
      EquipQTY_0: [{ 0: 1, 1: 1, 2: 0, length: 3 }],
      EMm0_0: JSON.stringify({ 0: { STR: 1 }, 1: { Weapon_Power: 70 } }),
      CurrentMap_0: 150,
    },
  });

  it("unequip:1 sets slot 1 to Blank and clears its stone upgrades, on a copy", () => {
    const orig = env();
    const out = whatIf(orig, "unequip:1") as ReturnType<typeof env>;
    expect(out.data.EquipOrder_0[0][1]).toBe("Blank");
    expect(out.data.EquipOrder_0[0][0]).toBe("EquipmentHats1");
    expect(out.data.EquipQTY_0[0][1]).toBe(0);
    expect(JSON.parse(out.data.EMm0_0)).toEqual({ 0: { STR: 1 } }); // still a JSON string
    expect(orig.data.EquipOrder_0[0][1]).toBe("EquipmentSword10"); // the input is untouched
  });

  it("map:<id> moves the character", () => {
    expect((whatIf(env(), "map:43") as ReturnType<typeof env>).data.CurrentMap_0).toBe(43);
  });

  it.each(["fly:1", "unequip:", "unequip:1:2", "unequip:1.5", "map:-1", "map:x", " map:3"])("rejects %j", (bad) => {
    expect(() => whatIf(env(), bad as never)).toThrow(/mutation/);
  });
});

describe("diagnose CLI inputs", () => {
  it("skips a reading whose save is missing, an unknown id and a stat without a kit tracker", async () => {
    const r = (id: string, stat: Reading["stat"]): Reading => ({
      id, stat, charIdx: 0, charName: "x", map: 0, capturedAt: "", game: "1x", saveFile: "no-such-save.json", saveSha1: "",
    });
    const { inputs, skipped } = await prepare(["a", "b", "nope"], [r("a", "coinMulti"), r("b", "maxHp")]);
    expect(inputs).toEqual([]);
    expect(skipped).toEqual([
      expect.stringMatching(/^a: save missing/),
      expect.stringMatching(/^b: .*kit tracker/),
      expect.stringMatching(/^nope: unknown reading/),
    ]);
  });
});
