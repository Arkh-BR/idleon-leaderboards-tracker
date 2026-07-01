import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { notate, OptimizerTable, AllocRow } from "@/components/cookingMastery/MasteryOptimizer";
import type { OptimizeResult, RoiRow } from "@/lib/cookingMastery/optimize";

describe("notate", () => {
  it("keeps a visible significant figure for tiny deltas instead of rounding to 0.00", () => {
    expect(notate(0.003)).not.toBe("0.00");
    expect(notate(0.003)).not.toBe("0");
    expect(notate(0.003)).toContain("3");
  });

  it("still renders whole numbers and large values exactly as before", () => {
    expect(notate(0)).toBe("0");
    expect(notate(3)).toBe("3");
    expect(notate(4.567)).toBe("4.57");
    expect(notate(12_345)).toBe("12.35K");
  });
});

function makeRow(overrides: Partial<RoiRow> & { id: number }): RoiRow {
  return {
    id: overrides.id,
    name: `Upgrade ${overrides.id}`,
    unlocked: true,
    rankReq: 0,
    base: 12,
    coef: 3,
    valuePerPt: 36,
    currentPts: 1,
    optimalPts: 2,
    marginalGain: 100,
    marginalGainPct: 1.5,
    ...overrides,
  };
}

function makeResult(rows: RoiRow[], bestUpgradeId: number | null): OptimizeResult {
  return {
    pools: { purpleTotal: 10, purpleSpent: 4, purpleAvailable: 6, yellowTotal: 0 },
    current: { purple: [], expRate: 1000, expRateCore: 1000 },
    optimal: { purple: [], expRate: 1200, expRateCore: 1200 },
    gainPct: 20,
    externalMulti: 1,
    calibrated: false,
    bestUpgradeId,
    roi: rows,
  };
}

describe("OptimizerTable — Value/pt column", () => {
  it("shows the computed product, not the raw base×coef string", () => {
    const rows = [makeRow({ id: 0, base: 12, coef: 3, valuePerPt: 36 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    expect(screen.getByText("36.0")).toBeInTheDocument();
    expect(screen.queryByText("12.0×3")).not.toBeInTheDocument();
  });

  it("gives the Value/pt header an explanatory tooltip", () => {
    const rows = [makeRow({ id: 0 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    const header = screen.getByText("Value/pt");
    expect(header.getAttribute("title")).toMatch(/base stat.*coefficient/i);
  });
});
