import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import LbDashboard from "@/components/leaderboards/LbDashboard";
import type { LbMeta, LbPlayer, MetaMetric } from "@/lib/leaderboards/types";
import type { LbSnapshot } from "@/lib/lbSnapshot";

vi.mock("@/lib/leaderboards/snapshot", () => ({
  LB_SNAPSHOT: {
    generatedAt: "2026-11-15T00:00:00Z",
    meta: { createdAt: 0, totalPlayers: 0, tabs: [] },
    boards: {
      a: { top100: 1100, top10: 2000, lowerIsBetter: false, firstSeen: "2026-01-01" },
      b: { top100: 4000, top10: 6000, lowerIsBetter: false, firstSeen: "2026-01-01" },
      c: { top100: 260, top10: 600, lowerIsBetter: false, firstSeen: "2026-01-01" },
      d: { top100: 50, top10: 100, lowerIsBetter: false, firstSeen: "2026-01-01" },
      e: { top100: 1, top10: 1, lowerIsBetter: false, firstSeen: "2026-01-01" },
    },
  },
}));

const m = (key: string, label: string, section: string, extra: Partial<MetaMetric> = {}): MetaMetric => ({
  key, label, notation: "default", top: 0, topTies: 1, players: 2790, maxed: false, section, ...extra,
});

const META: LbMeta = {
  createdAt: 0,
  totalPlayers: 2790,
  tabs: [
    { key: "account", label: "Account", sections: [{ name: "Totals", metrics: [m("a", "Alpha", "Totals"), m("b", "Beta", "Totals"), m("c", "Gamma", "Totals")] }] },
    {
      key: "skills",
      label: "Skills",
      sections: [
        {
          name: "Mining",
          metrics: [
            m("d", "Delta", "Mining"),
            m("e", "Echo", "Mining", { maxed: true, top: 500, topTies: 3 }),
            m("f", "Fox", "Mining", { maxed: true, top: 500, topTies: 2 }),
          ],
        },
      ],
    },
  ],
};

const PLAYER: LbPlayer = {
  createdAt: 1,
  player: { mainChar: "Foo", rank: 9, compositeScore: 0, profileAccess: "public", mainClass: 0, bestMetrics: [] },
  ranks: {
    a: { r: 812, v: 1000, p: 29.1, t: 1, nr: 811, nv: 1010 }, // climb pct 0.01
    b: { r: 50, v: 5000, p: 1.8, t: 1, nr: 49, nv: 5005 }, // 0.001
    c: { r: 300, v: 200, p: 10.7, t: 1, nr: 299, nv: 210 }, // 0.05
    d: { r: 2000, v: 10, p: 71.6, t: 1, nr: 1999, nv: 11 }, // 0.1
    e: { r: 5, v: 400, p: 0.18, t: 1, nr: 4, nv: 450 }, // 0.125
    f: { r: 1, v: 500, p: 0.03, t: 2 },
  },
};

const SNAP: LbSnapshot = {
  savedAt: "2026-11-01T12:00:00Z",
  player: "Foo",
  boards: { a: { rank: 900, score: 900 }, b: { rank: 40, score: 5000 } },
};

const props = { meta: META, player: PLAYER, snapshot: null, onSaveSnapshot: () => {}, history: [] };

const region = (name: string) => screen.getByRole("region", { name });
// First cell of each body row = the board label.
const boards = (name: string) =>
  within(region(name))
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent);

describe("LbDashboard", () => {
  it("asks for a player when none is loaded", () => {
    render(<LbDashboard {...props} player={null} />);
    expect(screen.getByText("Load a player to see your dashboard")).toBeInTheDocument();
  });

  it("worst positions are sorted by rank, so a tied #1 never shows up as a worst spot", () => {
    // IT's p counts the whole tie group: #1 tied with 824 players reads "top 29.3%" (Log Book, 2026-11-16).
    const tied = { ...PLAYER, ranks: { ...PLAYER.ranks, f: { r: 1, v: 500, p: 29.3, t: 824 }, b: { r: 50, v: 5000, p: 75, t: 1, nr: 49, nv: 5005 } } };
    render(<LbDashboard {...props} player={tied} />);
    expect(boards("Worst positions")).toEqual(["Delta", "Alpha", "Gamma", "Beta", "Echo", "Fox"]);
  });

  it("worst positions show rank / players, section, top % and the top-100 gap; the section filter narrows them", () => {
    render(<LbDashboard {...props} />);
    expect(boards("Worst positions")).toEqual(["Delta", "Alpha", "Gamma", "Beta", "Echo", "Fox"]);
    const alpha = within(region("Worst positions")).getAllByRole("row")[2];
    expect(within(alpha).getByText("#812 / 2,790")).toBeInTheDocument();
    expect(within(alpha).getByText("Totals")).toBeInTheDocument();
    expect(within(alpha).getByText("29.10%")).toBeInTheDocument();
    expect(within(alpha).getByText("+100")).toBeInTheDocument();

    const mining = within(region("Strength by section")).getByRole("button", { name: /Mining/ });
    fireEvent.click(mining);
    expect(mining).toHaveAttribute("aria-pressed", "true");
    expect(boards("Worst positions")).toEqual(["Delta", "Echo", "Fox"]);
    expect(boards("Cheapest climbs")).toEqual(["Delta", "Echo"]);
    expect(boards("Points to reach the top 100")).toEqual(["Delta"]);
    expect(boards("Your best positions")).toEqual(["Fox", "Echo", "Delta"]);
    expect(boards("Maxed boards you're missing")).toEqual(["Echo"]);

    fireEvent.click(within(region("Strength by section")).getByRole("button", { name: /^Totals/ }));
    expect(boards("Your best positions")).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(within(region("Maxed boards you're missing")).getByText("You're at the cap on every maxed board.")).toBeInTheDocument();

    fireEvent.click(within(region("Strength by section")).getByRole("button", { name: /^Totals/ }));
    expect(boards("Worst positions")).toHaveLength(6);
    expect(boards("Your best positions")).toEqual(["Fox", "Echo", "Beta", "Gamma", "Alpha", "Delta"]);
  });

  it("cheapest climbs are ordered by the smallest relative gap", () => {
    render(<LbDashboard {...props} />);
    expect(boards("Cheapest climbs")).toEqual(["Beta", "Alpha", "Gamma", "Delta", "Echo"]);
    const beta = within(region("Cheapest climbs")).getAllByRole("row")[1];
    expect(within(beta).getByText("+5")).toBeInTheDocument();
    expect(within(beta).getByText("#49")).toBeInTheDocument();
  });

  it("the top 100 / top 10 toggle switches the cutoff and the header", () => {
    render(<LbDashboard {...props} />);
    const r = region("Points to reach the top 100");
    expect(boards("Points to reach the top 100")).toEqual(["Alpha", "Gamma", "Delta"]);
    expect(within(r).getByRole("columnheader", { name: "#100 has" })).toBeInTheDocument();
    const alpha = within(r).getAllByRole("row")[1];
    expect(within(alpha).getByText("+100")).toBeInTheDocument();
    expect(within(alpha).getByText("1,100")).toBeInTheDocument();

    fireEvent.click(within(r).getByRole("button", { name: "Top 10" }));
    expect(screen.queryByRole("region", { name: "Points to reach the top 100" })).toBeNull();
    const r10 = region("Points to reach the top 10");
    expect(boards("Points to reach the top 10")).toEqual(["Beta", "Alpha", "Gamma", "Delta"]);
    expect(within(r10).getByRole("columnheader", { name: "#10 has" })).toBeInTheDocument();
    expect(within(r10).queryByRole("columnheader", { name: "#100 has" })).toBeNull();
  });

  it("maxed boards you're missing skip the ones where you're #1", () => {
    render(<LbDashboard {...props} />);
    const r = region("Maxed boards you're missing");
    expect(boards("Maxed boards you're missing")).toEqual(["Echo"]);
    const echo = within(r).getAllByRole("row")[1];
    expect(within(echo).getByText("400")).toBeInTheDocument();
    expect(within(echo).getByText("500")).toBeInTheDocument();
    expect(within(echo).getByText("3")).toBeInTheDocument();
  });

  it("tier summary counts the five bands", () => {
    render(<LbDashboard {...props} />);
    const r = region("Tier summary");
    const count = (label: string) => within(r).getByText(label).nextElementSibling?.textContent;
    expect([count("Top 10"), count("11–50"), count("51–100"), count("101–500"), count("500+")]).toEqual(["2", "1", "0", "1", "2"]);
  });

  it("the progress card shows the movement since the snapshot and saves", () => {
    const onSave = vi.fn();
    render(<LbDashboard {...props} snapshot={SNAP} onSaveSnapshot={onSave} />);
    const r = region("Progress since 11/1/2026");
    expect(within(r).getByText("+78")).toBeInTheDocument();
    expect(within(r).getByText("Boards climbed").nextElementSibling).toHaveTextContent("1");
    expect(within(r).getByText("Boards dropped").nextElementSibling).toHaveTextContent("1");
    fireEvent.click(within(r).getByRole("button", { name: /Update snapshot/ }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("without a snapshot the progress card offers to save one", () => {
    const onSave = vi.fn();
    render(<LbDashboard {...props} onSaveSnapshot={onSave} />);
    fireEvent.click(within(region("Progress")).getByRole("button", { name: /Save snapshot/ }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
