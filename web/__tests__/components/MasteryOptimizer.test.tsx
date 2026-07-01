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

describe("OptimizerTable — accessibility", () => {
  it("gives every column header a scope", () => {
    const rows = [makeRow({ id: 0 })];
    const { container } = render(<OptimizerTable result={makeResult(rows, 0)} />);
    const headers = container.querySelectorAll("th");
    expect(headers).toHaveLength(5);
    headers.forEach((th) => expect(th.getAttribute("scope")).toBe("col"));
  });

  it("has a visually-hidden caption describing the table", () => {
    const rows = [makeRow({ id: 0 })];
    const { container } = render(<OptimizerTable result={makeResult(rows, 0)} />);
    const caption = container.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption).toHaveClass("sr-only");
    expect(caption?.textContent).toMatch(/purple pts|roi|upgrade/i);
  });

  it("labels the best-upgrade chip with text, not color alone", () => {
    const rows = [makeRow({ id: 0 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    expect(screen.getByText("Next best")).toBeInTheDocument();
  });

  it("spells out 'Locked' instead of relying on the 🔒 emoji alone", () => {
    const rows = [makeRow({ id: 1, unlocked: false, rankReq: 42 })];
    render(<OptimizerTable result={makeResult(rows, null)} />);
    expect(screen.getByText(/Locked \(rank 42\)/)).toBeInTheDocument();
  });

  it("gives the +/- delta an explicit text alternative for color-blind users", () => {
    const rows = [makeRow({ id: 0, currentPts: 1, optimalPts: 3 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    expect(screen.getByLabelText(/increase of 2/i)).toBeInTheDocument();
  });
});
