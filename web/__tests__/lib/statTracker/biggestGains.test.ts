import { describe, it, expect } from "vitest";
import { computeGains, splitGains, groupedGainsModel } from "@/lib/statTracker/biggestGains";
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
