import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("a 502 or a network error says IT is unreachable, with a Retry that reloads the same name", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/lb/meta")) return json(META);
      if (!url.startsWith("/api/lb/player")) return json({ players: [] });
      calls++;
      if (calls === 1) return json({ error: "Failed to reach IdleonToolbox: HTTP 500" }, 502);
      if (calls === 2) throw new TypeError("Failed to fetch");
      return json(PLAYER);
    }));
    render(<LbPage />);
    load("Good");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't reach Idleon Toolbox.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach Idleon Toolbox."); // network error
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("#123")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    const playerCalls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]).filter((u) => u.startsWith("/api/lb/player"));
    expect(playerCalls).toEqual(Array(3).fill("/api/lb/player?name=Good"));
  });

  it("404 and 429 keep the route's text and offer no Retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/lb/meta")) return json(META);
      return json({ error: "Too many lookups today. Try again tomorrow." }, 429);
    }));
    render(<LbPage />);
    load("Good");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many lookups today. Try again tomorrow.");
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("an unexpected body is an error and clears the player", async () => {
    let bad = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/lb/meta")) return json(META);
      return bad ? json({ ranks: [], player: "x" }) : json(PLAYER);
    }));
    render(<LbPage />);
    load("Good");
    expect(await screen.findByText("#123")).toBeInTheDocument();
    bad = true;
    load("Good");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unexpected response from Idleon Toolbox.");
    expect(screen.queryByText("#123")).toBeNull();
  });

  it("Overview is the default tab; Dashboard asks for a player", async () => {
    render(<LbPage />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(screen.getByText("Load a player to see your dashboard")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Account (2)" });
  });

  it("the dashboard's Save button stores the manual snapshot", async () => {
    render(<LbPage />);
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    load("Good");
    fireEvent.click(await screen.findByRole("button", { name: /Save snapshot/ }));
    const saved = JSON.parse(localStorage.getItem("idleon-leaderboards.lb.ptsSnapshot.good")!);
    expect(saved.boards.alpha).toEqual({ rank: 50, score: 22424 });
    expect(await screen.findByRole("button", { name: /Update snapshot/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^Progress since / })).toBeInTheDocument();
  });

  it("keys the snapshot on the loaded player, not the in-flight name", async () => {
    const OTHER: LbPlayer = { ...PLAYER, player: { ...PLAYER.player, mainChar: "Other" }, ranks: { ...PLAYER.ranks, alpha: { ...PLAYER.ranks.alpha, r: 40 } } };
    const otherSnap = JSON.stringify({ savedAt: "2026-10-01T12:00:00Z", player: "Other", boards: { alpha: { rank: 70, score: 1 } } });
    localStorage.setItem("idleon-leaderboards.lb.ptsSnapshot.other", otherSnap);
    let resolveOther!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/lb/meta")) return json(META);
      if (url.includes("name=Other")) return new Promise<Response>((r) => (resolveOther = r));
      return json(PLAYER);
    }));
    render(<LbPage />);
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    load("Good");
    fireEvent.click(await screen.findByRole("button", { name: /Save snapshot/ }));
    const goodTitle = screen.getByRole("region", { name: /^Progress since / }).getAttribute("aria-labelledby");

    load("Other"); // pending: Good is still on screen
    const save = screen.getByRole("button", { name: /Update snapshot/ });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(localStorage.getItem("idleon-leaderboards.lb.ptsSnapshot.other")).toBe(otherSnap);
    expect(screen.queryByRole("region", { name: "Progress since 10/1/2026" })).toBeNull(); // no Good-vs-Other diff
    expect(screen.getByRole("region", { name: /^Progress since / }).getAttribute("aria-labelledby")).toBe(goodTitle);

    resolveOther(json(OTHER));
    const card = await screen.findByRole("region", { name: "Progress since 10/1/2026" });
    expect(within(card).getByText("+30")).toBeInTheDocument(); // Other's alpha 70 → 40
    expect(within(card).getByRole("button", { name: /Update snapshot/ })).toBeEnabled();
  });
});
