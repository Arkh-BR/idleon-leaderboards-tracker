import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeepView from "@/components/dropRate/DeepView";

const tree = { name: "Drop Rate", val: 2, fmt: "x" as const, children: [] };
const baseline = { flatTree: { "Drop Rate": 1 }, capturedAt: 0, charName: "Alpha" };

describe("DeepView — the comparison banner's hint", () => {
  it("defaults to the original hint (Talents' 🧪 Observed Max Lv tab)", () => {
    render(<DeepView tree={tree} baseline={baseline} bare />);
    const hint = screen.getByText("Pick another snapshot to switch — toggle off in Snapshot History");
    expect(hint).toHaveAttribute("title", "Pick another snapshot to switch — toggle off in Snapshot History");
  });

  it("shows the caller's hint instead", () => {
    render(<DeepView tree={tree} baseline={baseline} baselineHint="Uncheck Compare vs Observed Max to hide it" />);
    expect(screen.getByText("Uncheck Compare vs Observed Max to hide it")).toHaveAttribute(
      "title",
      "Uncheck Compare vs Observed Max to hide it"
    );
    expect(screen.queryByText(/toggle off in/)).toBeNull();
  });
});
