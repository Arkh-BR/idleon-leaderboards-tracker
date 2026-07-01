import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OptimizerTable } from "@/components/cookingMastery/MasteryOptimizer";
import type { OptimizeResult, RoiRow } from "@/lib/cookingMastery/optimize";

function makeRow(overrides: Partial<RoiRow>): RoiRow {
  return {
    id: 0,
    name: "EXP boost via Mastery Rank",
    unlocked: true,
    rankReq: 0,
    base: 10,
    coef: 0.5,
    valuePerPt: 5,
    currentPts: 2,
    optimalPts: 4,
    marginalGain: 100,
    marginalGainPct: 1.5,
    ...overrides,
  };
}

function makeResult(roi: RoiRow[], bestUpgradeId: number | null): OptimizeResult {
  return {
    pools: { purpleTotal: 10, purpleSpent: 6, purpleAvailable: 4, yellowTotal: 0 },
    current: { purple: [2, 0], expRate: 1000, expRateCore: 1 },
    optimal: { purple: [4, 0], expRate: 1200, expRateCore: 1.2 },
    gainPct: 20,
    externalMulti: 1,
    calibrated: false,
    bestUpgradeId,
    roi,
  };
}

describe("OptimizerTable — mobile column collapse", () => {
  it("keeps Upgrade, Optimal and ROI /pt headers always visible (no `hidden` class)", () => {
    const result = makeResult([makeRow({ id: 0 })], 0);
    render(<OptimizerTable result={result} />);

    for (const label of ["Upgrade", "Optimal", "ROI /pt"]) {
      const th = screen.getByRole("columnheader", { name: label });
      expect(th.className).not.toMatch(/\bhidden\b/);
    }
  });

  it("hides Value/pt and Current headers below the sm breakpoint", () => {
    const result = makeResult([makeRow({ id: 0 })], 0);
    render(<OptimizerTable result={result} />);

    for (const label of ["Value/pt", "Current"]) {
      const th = screen.getByRole("columnheader", { name: label });
      expect(th.className).toMatch(/\bhidden\b/);
      expect(th.className).toMatch(/\bsm:table-cell\b/);
    }
  });

  it("stacks the row's name and chips vertically on mobile, inline from sm up", () => {
    const lockedRow = makeRow({ id: 1, unlocked: false, rankReq: 5 });
    const result = makeResult([lockedRow], null);
    render(<OptimizerTable result={result} />);

    const lockChip = screen.getByText(/🔒 rank 5/);
    const stack = lockChip.closest("[data-role='upgrade-cell-stack']");
    expect(stack).not.toBeNull();
    expect(stack!.className).toMatch(/\bflex-col\b/);
    expect(stack!.className).toMatch(/\bsm:flex-row\b/);
  });
});
