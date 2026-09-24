import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatSnapshotSection from "@/components/statTracker/StatSnapshotSection";
import type { StatCalculatorState } from "@/components/statTracker/StatCalculator";
import { testConfig } from "./testConfig";

const state = (): StatCalculatorState => ({
  charIndex: 0,
  charName: "Alpha",
  classKey: null,
  charSummary: null,
  total: 12.5,
  mapIndex: 1,
  mapLabel: "W1 · Spore Meadows",
  save: { charNames: ["Alpha"], data: { PVStatList_0: [1, 1, 1, 1, 50] } },
  tree: { name: "Test Multi", val: 12.5, fmt: "x", children: [] },
  computeError: null,
});

beforeEach(() => localStorage.clear());

describe("StatSnapshotSection", () => {
  it("can't save without a computed state", () => {
    render(<StatSnapshotSection config={testConfig} state={null} />);
    // getByText(/Save snapshot/) is ambiguous here: the empty-state copy
    // ("Click "Save snapshot" above…", unchanged from Coin) also matches.
    expect(screen.getByRole("button", { name: /Save snapshot/ })).toBeDisabled();
  });

  it("saves into the stat's own key and names the stat in the notice", () => {
    localStorage.setItem(testConfig.storage.collapse, "0");
    render(<StatSnapshotSection config={testConfig} state={state()} />);
    fireEvent.click(screen.getByRole("button", { name: /Save snapshot/ }));
    expect(screen.getByText(/Snapshot saved for Alpha — Test Multi 12.50x on W1 · Spore Meadows/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(testConfig.storage.snapshots)!).snapshotsByChar.Alpha).toHaveLength(1);
  });
});
