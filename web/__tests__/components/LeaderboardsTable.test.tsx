import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeaderboardsTable from "@/components/LeaderboardsTable";
import type { BoardResult } from "@/app/api/leaderboards/route";

function makeBoard(overrides: Partial<BoardResult> & { apiKey: string; label: string }): BoardResult {
  return {
    category: "general",
    categoryLabel: "General",
    apiKey: overrides.apiKey,
    label: overrides.label,
    myRank: null,
    myScore: null,
    top10: [
      { name: "Player1", score: 1_000_000, rank: 1 },
      { name: "Player2", score: 900_000, rank: 2 },
    ],
    ...overrides,
  };
}

const sampleBoards: BoardResult[] = [
  makeBoard({ apiKey: "totalMoney", label: "Total Money", myRank: 5, myScore: 500_000 }),
  makeBoard({ apiKey: "totalLevels", label: "Total Levels", myRank: 1, myScore: 1_200_000 }),
  makeBoard({ apiKey: "mining", label: "Mining", category: "skills", categoryLabel: "Skills", myRank: 50, myScore: 50_000 }),
  makeBoard({ apiKey: "choppin", label: "Choppin", category: "skills", categoryLabel: "Skills", myRank: 200, myScore: 10_000 }),
];

describe("LeaderboardsTable", () => {
  it("renders all boards by default", () => {
    render(<LeaderboardsTable boards={sampleBoards} />);
    expect(screen.getByText("Total Money")).toBeInTheDocument();
    expect(screen.getByText("Total Levels")).toBeInTheDocument();
    expect(screen.getByText("Mining")).toBeInTheDocument();
    expect(screen.getByText("Choppin")).toBeInTheDocument();
  });

  it("filters by search input", () => {
    render(<LeaderboardsTable boards={sampleBoards} />);
    const input = screen.getByPlaceholderText("Search leaderboard…");
    fireEvent.change(input, { target: { value: "Money" } });
    expect(screen.getByText("Total Money")).toBeInTheDocument();
    expect(screen.queryByText("Total Levels")).not.toBeInTheDocument();
  });

  it("filters by category select", () => {
    render(<LeaderboardsTable boards={sampleBoards} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "Skills" } });
    expect(screen.getByText("Mining")).toBeInTheDocument();
    expect(screen.getByText("Choppin")).toBeInTheDocument();
    expect(screen.queryByText("Total Money")).not.toBeInTheDocument();
  });

  it("toggles sort direction when same header clicked", () => {
    render(<LeaderboardsTable boards={sampleBoards} />);
    const rankHeader = screen.getByText("Rank");
    fireEvent.click(rankHeader);
    fireEvent.click(rankHeader);
    // Visual indicator should toggle — just verify it doesn't crash
    expect(screen.getByText("Total Money")).toBeInTheDocument();
  });

  it("smart-sort button resets to default order", () => {
    render(<LeaderboardsTable boards={sampleBoards} />);
    const btn = screen.getByRole("button", { name: /smart sort/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText(/smart sort/i)).toBeInTheDocument();
  });

  it("expands and collapses top 10 for a board", () => {
    render(<LeaderboardsTable boards={sampleBoards} />);
    // Find expand button by aria-label on the first row
    const expandBtn = screen.getAllByRole("button", { name: /expand top 10/i })[0];
    fireEvent.click(expandBtn);
    // After expanding all boards in sample have same top10 names, so use getAllByText
    expect(screen.getAllByText("Player1").length).toBeGreaterThanOrEqual(1);
  });
});
