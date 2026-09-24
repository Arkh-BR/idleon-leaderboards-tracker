import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeepView from "@/components/dropRate/DeepView";

// Coin Multi groups reach 1e11x and sources 1e13 — printed in full they
// overflowed the value column. The site-wide number format (lib/numberFormat)
// suffixes every "x" and "+" value past 1e3 with K/M/B/T… at 3 decimals.
//
// The suffix renders as its own highlighted <span>, so a value's text is
// split across sibling nodes — match by the container's full textContent
// (a function matcher) instead of getByText on the split string.
const byText = (text: string) => (_: string, el: Element | null) =>
  el?.textContent === text;

describe("DeepView — big multipliers and additives", () => {
  it("suffixes x/+ values past 1e3 and keeps 3 decimals everywhere", () => {
    render(
      <DeepView
        tree={{
          name: "Coin Multi",
          val: 1e10,
          fmt: "x",
          children: [
            { name: "Lab · Vault Kills", val: 171140496624.184, fmt: "x" },
            { name: "Lab Mainframe 9", val: 17114049124784.227, fmt: "+" },
            { name: "Arena · Friend · Statue", val: 20696.661, fmt: "x" },
            { name: "Meals", val: 120491.29, fmt: "+" },
          ],
        }}
      />
    );
    expect(screen.getByText(byText("171.140Bx"))).toBeInTheDocument();
    expect(screen.getByText(byText("+17.114T"))).toBeInTheDocument();
    expect(screen.getByText(byText("20.697Kx"))).toBeInTheDocument();
    expect(screen.getByText(byText("+120.491K"))).toBeInTheDocument();
    // Full precision stays available on hover.
    expect(screen.getByText(byText("171.140Bx"))).toHaveAttribute(
      "title",
      "171140496624.184"
    );
  });
});
