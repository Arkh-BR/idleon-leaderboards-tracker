import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Scoring isn't under test: record what each panel scores.
const tome = vi.hoisted(() => ({ computeTome: vi.fn() }));
vi.mock("@/lib/tome/compute", () => tome);

import BestTomePanel from "@/components/tome/BestTomePanel";
import TomeRawPanel from "@/components/tome/TomeRawPanel";

const RESULT = { rows: [], totalPts: 0, coveredCount: 0, missingCount: 0, usedParsedTomePoints: false };
const A = { charNames: ["Alpha"], data: { Lv0_0: 1 } };
const B = { charNames: ["Alpha"], data: { Lv0_0: 2 } };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "");
  tome.computeTome.mockReset().mockReturnValue(RESULT);
});

afterEach(() => vi.unstubAllEnvs());

describe("Tome panels apply the page's save", () => {
  it("Best Tome scores each new save in place — the search survives", () => {
    const { rerender } = render(<BestTomePanel loaded={A} />);
    expect(tome.computeTome).toHaveBeenLastCalledWith(A);
    fireEvent.change(screen.getByPlaceholderText("Search task…"), { target: { value: "jelly" } });
    rerender(<BestTomePanel loaded={B} />);
    expect(tome.computeTome).toHaveBeenLastCalledWith(B);
    expect(screen.getByPlaceholderText("Search task…")).toHaveValue("jelly");
  });

  it("Raw tab shows the page's save; a calculated paste goes back to the page", () => {
    const onPasted = vi.fn();
    render(<TomeRawPanel loaded={A} onPasted={onPasted} />);
    expect(tome.computeTome).toHaveBeenLastCalledWith(A);
    fireEvent.change(screen.getByPlaceholderText(/Paste the output of "Copy for Support"/), {
      target: { value: '{"x":1}' },
    });
    fireEvent.click(screen.getByText("Calculate Tome"));
    expect(onPasted).toHaveBeenCalledWith('{"x":1}');
    expect(localStorage.getItem("idleon-leaderboards.tome.rawJson")).toBe('{"x":1}');
    expect(tome.computeTome).toHaveBeenLastCalledWith('{"x":1}');
  });
});
