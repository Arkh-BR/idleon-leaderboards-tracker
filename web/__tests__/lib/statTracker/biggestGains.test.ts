import { describe, it, expect } from "vitest";
import { computeGains, splitGains, groupedGainsModel } from "@/lib/statTracker/biggestGains";
import type { GainsModel } from "@/lib/statTracker/config";
import type { StatGroup } from "@/lib/arkh/stats/defs/grouped";

const GROUPS: StatGroup[] = [
  { key: "p", name: "P", kind: "pct", sources: ["a", "b"] },
  { key: "r", name: "R", kind: "raw", sources: ["x"] },
  { key: "m4", name: "M4", kind: "min4", sources: ["c"] },
  { key: "mu", name: "MU", kind: "mult", max1: true, sources: ["k", "l"] },
];
const model = groupedGainsModel("Root", GROUPS);
const P = "Root / P", R = "Root / R", M4 = "Root / M4", MU = "Root / MU";

describe("what-if Biggest Gains over grouped stats", () => {
  it("pct: the new group factor over the old one", () => {
    const yours = { [P]: 4, [`${P} / A`]: 100, [`${P} / B`]: 200 };
    const { rows } = computeGains(model, yours, { [`${P} / A`]: 400 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", group: "P", display: "pct", you: 100, max: 400 });
    expect(rows[0].gainPct).toBeCloseTo(75, 9); // (1 + 6) / 4 − 1
  });

  it("raw has no /100; min4 caps at 4", () => {
    expect(computeGains(model, { [`${R} / X`]: 0.5 }, { [`${R} / X`]: 1.5 }).rows[0].gainPct).toBeCloseTo((2.5 / 1.5 - 1) * 100, 9);
    expect(computeGains(model, { [`${M4} / C`]: 2 }, { [`${M4} / C`]: 9 }).rows[0].gainPct).toBeCloseTo((5 / 3 - 1) * 100, 9);
  });

  it("mult: max / you, displayed as a multiplier", () => {
    const { rows } = computeGains(model, { [`${MU} / K`]: 2, [`${MU} / L`]: 3 }, { [`${MU} / K`]: 5 });
    expect(rows[0]).toMatchObject({ display: "x" });
    expect(rows[0].gainPct).toBeCloseTo(150, 9); // 15 / 6 − 1
  });

  it("a source only the reference has counts as you = 0", () => {
    const { rows } = computeGains(model, { [`${P} / A`]: 100 }, { [`${P} / New`]: 100 });
    expect(rows[0]).toMatchObject({ source: "New", you: 0 });
    expect(rows[0].gainPct).toBeCloseTo(50, 9); // 3 / 2 − 1
  });

  it("ignores sources at the max and nested paths; sorts descending", () => {
    const yours = { [`${P} / A`]: 50, [`${P} / A / Detail`]: 1, [`${P} / B`]: 50, [`${R} / X`]: 1 };
    const ref = { [`${P} / A`]: 50, [`${P} / B`]: 150, [`${R} / X`]: 1.5, [`${P} / A / Detail`]: 99 };
    const res = computeGains(model, yours, ref);
    expect(res.comparableSources).toBe(3);
    expect(res.rows.map((r) => r.source)).toEqual(["B", "X"]);
  });

  it("totalFromFlat multiplies every group", () => {
    expect(model.totalFromFlat({ [`${P} / A`]: 50, [`${R} / X`]: 1, [`${MU} / K`]: 3 })).toBeCloseTo(1.5 * 2 * 1 * 3, 12);
  });

  it("splits minor gains below 0.05%", () => {
    const rows = [
      { path: "a", group: "g", source: "a", display: "pct" as const, you: 0, max: 1, gainPct: 2 },
      { path: "b", group: "g", source: "b", display: "pct" as const, you: 0, max: 1, gainPct: 0.01 },
    ];
    const { major, minor } = splitGains(rows);
    expect(major.map((r) => r.path)).toEqual(["a"]);
    expect(minor.map((r) => r.path)).toEqual(["b"]);
  });
});

describe("skip option — circumstantial sources excluded from ranking, kept in the total", () => {
  const skipModel = groupedGainsModel("Root", GROUPS, { skip: ["A"] });

  it("sources()/computeGains() omit the skipped source", () => {
    const yours = { [`${P} / A`]: 100, [`${P} / B`]: 200 };
    const ref = { [`${P} / A`]: 400, [`${P} / B`]: 400 };
    expect(skipModel.sources(yours, ref).map((s) => s.source)).toEqual(["B"]);
    const { rows, comparableSources } = computeGains(skipModel, yours, ref);
    expect(rows.map((r) => r.source)).toEqual(["B"]);
    expect(comparableSources).toBe(1);
  });

  it("totalFromFlat still sums the skipped source", () => {
    const yours = { [`${P} / A`]: 100, [`${P} / B`]: 200 };
    expect(skipModel.totalFromFlat(yours)).toBeCloseTo(model.totalFromFlat(yours), 12);
  });
});

describe("model levers — model-computed steps ranked but not comparable sources", () => {
  it("ranks the model's levers with the sources, without counting them as comparable", () => {
    const lever = { path: "Root / Step", group: "Levers", source: "+1 step", display: "raw" as const, you: 1, max: 2, gainPct: 60 };
    const withLevers: GainsModel = { ...model, levers: () => [lever, { ...lever, path: "Root / Flat", source: "flat", gainPct: 0 }] };
    const res = computeGains(withLevers, { [`${P} / A`]: 100, [`${P} / B`]: 200 }, { [`${P} / A`]: 400 });
    expect(res.comparableSources).toBe(1);
    expect(res.rows.map((r) => r.source)).toEqual(["A", "+1 step"]); // 75% then 60%; the 0% lever is dropped
    expect(res.rows.map((r) => r.lever)).toEqual([undefined, true]);
  });
});
