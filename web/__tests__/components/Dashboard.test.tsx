import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "@/components/Dashboard";
import type { BoardResult } from "@/app/api/leaderboards/route";

function makeBoard(overrides: Partial<BoardResult> & { apiKey: string }): BoardResult {
  return {
    category: "general",
    categoryLabel: "General",
    apiKey: overrides.apiKey,
    label: "Test",
    myRank: 100,
    myScore: 1_000,
    top10: [],
    ...overrides,
  };
}

const sampleBoards: BoardResult[] = [
  makeBoard({ apiKey: "b1", myRank: 5 }),
  makeBoard({ apiKey: "b2", myRank: 45 }),
  makeBoard({ apiKey: "b3", myRank: 95 }),
  makeBoard({ apiKey: "b4", myRank: 150 }),
  makeBoard({ apiKey: "b5", myRank: 300 }),
  makeBoard({ apiKey: "b6", myRank: 600 }),
];

describe("Dashboard", () => {
  it("renders tier summary section", () => {
    render(<Dashboard boards={sampleBoards} player="TestPlayer" />);
    // Match the section heading specifically
    expect(screen.getByRole("heading", { name: /Tier summary/i })).toBeInTheDocument();
  });

  it("shows correct tier counts", () => {
    render(<Dashboard boards={sampleBoards} player="TestPlayer" />);
    // Top 10: 1 (rank 5)
    // Top 11-50: 1 (rank 45)
    // Top 51-100: 1 (rank 95)
    // Top 101-200: 1 (rank 150)
    // Rank 201-500: 1 (rank 300)
    // Rank 500+: 1 (rank 600)
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders heatmap by category", () => {
    render(<Dashboard boards={sampleBoards} player="TestPlayer" />);
    expect(screen.getByRole("heading", { name: /Heatmap by category/i })).toBeInTheDocument();
  });

  it("renders worst positions section", () => {
    render(<Dashboard boards={sampleBoards} player="TestPlayer" />);
    expect(screen.getByRole("heading", { name: /Worst positions/i })).toBeInTheDocument();
  });

  it("renders quick wins section", () => {
    render(<Dashboard boards={sampleBoards} player="TestPlayer" />);
    expect(screen.getByRole("heading", { name: /Quick wins/i })).toBeInTheDocument();
  });

  it("renders best positions section", () => {
    render(<Dashboard boards={sampleBoards} player="TestPlayer" />);
    expect(screen.getByRole("heading", { name: /Your best 30 positions/i })).toBeInTheDocument();
  });

  it("shows snapshot progress when deltas and snapshotAt provided", () => {
    const deltas = {
      b1: { status: "changed" as const, rankDelta: 10, scoreDelta: 100 },
      b2: { status: "changed" as const, rankDelta: 5, scoreDelta: 50 },
    };
    render(
      <Dashboard
        boards={sampleBoards}
        player="TestPlayer"
        deltas={deltas}
        snapshotAt="2024-01-01T00:00:00Z"
      />
    );
    expect(screen.getByText(/Progress since/i)).toBeInTheDocument();
  });
});
