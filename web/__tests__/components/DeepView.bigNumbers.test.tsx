import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeepView from "@/components/dropRate/DeepView";

// Coin Multi groups reach 1e11x and sources 1e13 — printed in full they
// overflowed the value column. Past 1e6 the "x" and "+" formats use the same
// K/M/B/T suffixes as raw rows; smaller values (every Drop Rate number) keep
// their full-precision form.

describe("DeepView — big multipliers and additives", () => {
  it("suffixes x/+ values past 1e6 and leaves smaller ones alone", () => {
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
    expect(screen.getByText("171.14Bx")).toBeInTheDocument();
    expect(screen.getByText("+17.11T")).toBeInTheDocument();
    expect(screen.getByText("20696.661x")).toBeInTheDocument();
    expect(screen.getByText("+120491.290")).toBeInTheDocument();
    // Full precision stays available on hover.
    expect(screen.getByText("171.14Bx")).toHaveAttribute("title", "171140496624.184");
  });
});
