import { describe, it, expect } from "vitest";
import { compareGroundTruth, compareRegression, type EngineSummary } from "../../scripts/updater/golden/checks";

describe("golden checks", () => {
  it("flags a per-task Tome mismatch beyond tolerance", () => {
    const got = { tomeByTask: [10, 20, 30], drTotal: 5, cookingExp: 100, talentsTotal: 50 } as EngineSummary;
    const truth = { tomePoints: [10, 20, 31], dropRate: 5 };
    const ms = compareGroundTruth("ARKHE", got, truth, { tomeTol: 0, drTolPct: 1 });
    expect(ms.some((m) => m.kind === "tome" && m.key === "task#2")).toBe(true);
  });

  it("passes Tome when per-task matches and DR within tolerance", () => {
    const got = { tomeByTask: [10, 20, 30], drTotal: 100, cookingExp: 0, talentsTotal: 0 } as EngineSummary;
    const truth = { tomePoints: [10, 20, 30], dropRate: 100.5 }; // 0.5% off
    const ms = compareGroundTruth("ARKHE", got, truth, { tomeTol: 0, drTolPct: 1 });
    expect(ms.length).toBe(0);
  });

  it("flags a regression when a summary value drifts from baseline", () => {
    const base = { ARKHE: { tomeTotal: 1000, drTotal: 5, cookingExp: 100, talentsTotal: 50 } };
    const got: EngineSummary = { tomeByTask: [], tomeTotal: 1000, drTotal: 5, cookingExp: 110, talentsTotal: 50 };
    const ms = compareRegression("ARKHE", got, base, 0); // 0% tolerance
    expect(ms.some((m) => m.kind === "regression" && m.key === "cookingExp")).toBe(true);
  });
});
