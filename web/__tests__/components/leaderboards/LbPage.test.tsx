import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LbPage from "@/components/leaderboards/LbPage";
import type { LbMeta, LbPlayer } from "@/lib/leaderboards/types";

vi.mock("@/lib/leaderboards/snapshot", () => ({
  LB_SNAPSHOT: {
    generatedAt: "2026-11-15T00:00:00Z",
    meta: { createdAt: 0, totalPlayers: 0, tabs: [] },
    boards: { alpha: { top100: 1, lowerIsBetter: false, firstSeen: "2026-01-01" } },
  },
}));

const META: LbMeta = {
  createdAt: Date.UTC(2026, 10, 15, 13, 0),
  totalPlayers: 2809,
  tabs: [
    {
      key: "account",
      label: "Account",
      sections: [
        {
          name: "Totals",
          metrics: [
            { key: "alpha", label: "Alpha", notation: "default", top: 0, topTies: 1, players: 2809, maxed: false, section: "Totals" },
            { key: "beta", label: "Beta", notation: "default", top: 0, topTies: 1, players: 2809, maxed: false, section: "Totals" },
          ],
        },
      ],
    },
  ],
};

const PLAYER: LbPlayer = {
  createdAt: 2,
  player: { mainChar: "Good", rank: 123, compositeScore: 0, profileAccess: "public", mainClass: 0, bestMetrics: [] },
  ranks: {
    alpha: { r: 50, v: 22424, p: 1.8, t: 1, nr: 49, nv: 22459 },
    beta: { r: 7, v: 100, p: 0.2, t: 1, nr: 6, nv: 110 },
  },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function load(name: string) {
  fireEvent.change(screen.getByLabelText("Player name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Load" }));
}

describe("LbPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/lb/meta")) return json(META);
      if (url.includes("name=Good")) return json(PLAYER);
      return json({ error: "Player not found. Check the name or make the profile public on Idleon Toolbox." }, 404);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads a player and shows the four cards", async () => {
    // A previous visit: global #130, alpha #52 → ▲7 global, +2 net.
    localStorage.setItem("idleon-leaderboards.v4.baseline.good", JSON.stringify({ createdAt: 1, ranks: { alpha: 52 }, globalRank: 130 }));
    render(<LbPage />);
    expect(await screen.findByText("2,809 players", { exact: false })).toBeInTheDocument();
    load("Good");
    expect(await screen.findByText("#123")).toBeInTheDocument();
    expect(screen.getByText("▲7")).toBeInTheDocument();
    expect(screen.getByText("Net moves")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("Top 10 boards").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Top 100 boards").nextElementSibling).toHaveTextContent("2");
    expect(localStorage.getItem("idleon-leaderboards.player")).toBe("Good");
  });

  it("a 404 shows the message and clears the rows", async () => {
    render(<LbPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Account (2)" }));
    load("Good");
    expect(await screen.findByText("+35 passes #49")).toBeInTheDocument();
    load("Bad");
    expect(await screen.findByText(/Player not found/)).toBeInTheDocument();
    expect(screen.queryByText("+35 passes #49")).toBeNull();
    expect(screen.queryByText("#123")).toBeNull();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("Overview and Dashboard are placeholders", async () => {
    render(<LbPage />);
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
    await screen.findByRole("button", { name: "Account (2)" });
  });
});
