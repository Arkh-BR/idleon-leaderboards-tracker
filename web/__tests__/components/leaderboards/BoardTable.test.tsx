import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import BoardTable from "@/components/leaderboards/BoardTable";
import { isNewBoard } from "@/lib/leaderboards/meta";
import type { LbPlayer, MetaMetric, MetaTab } from "@/lib/leaderboards/types";

vi.mock("@/lib/leaderboards/snapshot", () => ({
  LB_SNAPSHOT: {
    generatedAt: "2026-11-15T00:00:00Z",
    meta: { createdAt: 0, totalPlayers: 0, tabs: [] },
    boards: {
      alpha: { top100: 1, lowerIsBetter: false, firstSeen: "2026-11-10" },
      beta: { lowerIsBetter: false, firstSeen: "2026-01-01" },
      gamma: { lowerIsBetter: false, firstSeen: "2026-01-01" },
      delta: { top100: 9880, lowerIsBetter: false, firstSeen: "2026-01-01" },
      stale: { top100: 9880, lowerIsBetter: false, firstSeen: "2026-01-01" },
      secs: { top100: 20, lowerIsBetter: false, firstSeen: "2026-01-01" },
    },
  },
}));

const m = (key: string, label: string, maxed = false): MetaMetric => ({
  key, label, notation: "default", top: 0, topTies: 1, players: 2809, maxed, section: "Totals",
});

const TAB: MetaTab = {
  key: "account",
  label: "Account",
  sections: [{ name: "Totals", metrics: [m("alpha", "Alpha"), m("beta", "Beta", true), m("gamma", "Gamma"), m("delta", "Delta")] }],
};

const PLAYER: LbPlayer = {
  createdAt: 1,
  player: { mainChar: "Foo", rank: 123, compositeScore: 0, profileAccess: "public", mainClass: 0, bestMetrics: [] },
  ranks: {
    alpha: { r: 50, v: 22424, p: 1.8, t: 1, nr: 49, nv: 22459 }, // pct ~0.0016
    beta: { r: 1, v: 5, p: 0.03, t: 58 },
    gamma: { r: 140, v: 9470, p: 5, t: 1, nr: 139, nv: 9500 }, // pct ~0.0032, no top-100 cutoff
    delta: { r: 140, v: 9470, p: 5, t: 1, nr: 139, nv: 9471 }, // pct ~0.0001
  },
};

const row = (key: string) => document.getElementById(`board-${key}`)!;

describe("BoardTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("renders to-climb, to-top-100 and the badges", () => {
    render(<BoardTable tab={TAB} player={PLAYER} moves={{ alpha: 3, gamma: -2 }} sort="it" hideAnon={false} />);
    expect(within(row("alpha")).getByText("+35 passes #49")).toBeInTheDocument();
    expect(within(row("alpha")).getByText("in top 100")).toBeInTheDocument();
    expect(within(row("beta")).getByText("tied #1 (58)")).toBeInTheDocument();
    expect(within(row("delta")).getByText("+410")).toBeInTheDocument();
    const dash = within(row("gamma")).getByTitle("available after the next daily refresh");
    expect(dash).toHaveTextContent("—");
    expect(within(row("beta")).getByText("Maxed")).toBeInTheDocument();
    expect(screen.getAllByText("New")).toHaveLength(1);
    expect(within(row("alpha")).getByText("New")).toBeInTheDocument();
    expect(within(row("alpha")).getByText("▲3")).toBeInTheDocument();
    expect(within(row("gamma")).getByText("▼2")).toBeInTheDocument();
    expect(within(row("alpha")).getByTitle("#50 / 2,809 players")).toHaveTextContent("#50");
    expect(within(row("alpha")).getByText("22,424")).toBeInTheDocument();
    expect(within(row("alpha")).getByText("1.80%")).toBeInTheDocument();
  });

  it("leaves player columns empty without a player", () => {
    render(<BoardTable tab={TAB} player={null} moves={{}} sort="it" hideAnon={false} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText(/passes/)).toBeNull();
    expect(screen.queryByText("in top 100")).toBeNull();
  });

  it("closest sort: smallest gap % first, #1 boards last", () => {
    const { container } = render(<BoardTable tab={TAB} player={PLAYER} moves={{}} sort="closest" hideAnon={false} />);
    const ids = [...container.querySelectorAll("tr[id^='board-']")].map((r) => r.id);
    expect(ids).toEqual(["board-delta", "board-alpha", "board-gamma", "board-beta"]);
  });

  it("worst sort: highest rank first, so a tied #1 (IT's p counts the tie group) sorts last", () => {
    const tied = { ...PLAYER, ranks: { ...PLAYER.ranks, beta: { r: 1, v: 5, p: 29.3, t: 824 } } };
    const { container } = render(<BoardTable tab={TAB} player={tied} moves={{}} sort="worst" hideAnon={false} />);
    const ids = [...container.querySelectorAll("tr[id^='board-']")].map((r) => r.id);
    expect(ids).toEqual(["board-gamma", "board-delta", "board-alpha", "board-beta"]);
  });
});

describe("BoardTable guards", () => {
  const tab: MetaTab = {
    key: "x",
    label: "X",
    sections: [{ name: "S", metrics: [m("stale", "Stale"), { ...m("secs", "Secs"), notation: "seconds" }] }],
  };
  const player: LbPlayer = {
    ...PLAYER,
    ranks: {
      // #105 live, but already above yesterday's #100 value (9880): the snapshot cutoff is stale.
      stale: { r: 105, v: 10000, p: 3.7, t: 1, nr: 104, nv: 10000 },
      secs: { r: 105, v: 0, p: 3.7, t: 1, nr: 104, nv: 10 },
    },
  };

  it("stale cutoff, zero gap and a zero seconds rate render — instead of a bogus gap", () => {
    render(<BoardTable tab={tab} player={player} moves={{}} sort="it" hideAnon={false} />);
    for (const key of ["stale", "secs"]) {
      const r = within(row(key));
      expect(r.getByTitle("available after the next daily refresh")).toHaveTextContent("—");
      expect(r.queryByText(/passes|Infinity|\+-|\+0/)).toBeNull();
    }
  });
});

describe("isNewBoard", () => {
  const today = new Date("2026-11-29T12:00:00Z");
  it("new within 14 days, not after", () => {
    expect(isNewBoard("2026-11-15", today)).toBe(true);
    expect(isNewBoard("2026-11-14", today)).toBe(false);
    expect(isNewBoard(undefined, today)).toBe(false);
  });
});
