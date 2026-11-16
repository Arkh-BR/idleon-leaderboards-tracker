import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LbOverview from "@/components/leaderboards/LbOverview";
import HistoryChart from "@/components/leaderboards/HistoryChart";
import type { LbMeta } from "@/lib/leaderboards/types";

const tab = (key: string, n: number) => ({
  key,
  label: key.toUpperCase(),
  sections: [{ name: "S", metrics: Array.from({ length: n }, (_, i) => ({ key: `${key}${i}`, label: `${key}${i}`, notation: "default" as const, top: 0, topTies: 1, players: 10, maxed: false, section: "S" })) }],
});
const META: LbMeta = { createdAt: 0, totalPlayers: 10, tabs: ["a", "b", "c", "d", "e"].map((k, i) => tab(k, i + 1)) };
const top = Array.from({ length: 10 }, (_, i) => ({ mainChar: `Name${i + 1}`, value: 1000 * (10 - i), rank: i + 1 }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("LbOverview", () => {
  it("shows the top 10, one card per tab, and cards open their tab", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ metric: "globalRanking", createdAt: 0, top, around: [] })));
    const onOpenTab = vi.fn();
    render(<LbOverview meta={META} onOpenTab={onOpenTab} player="Name3" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("Name10")).toBeInTheDocument();
    for (let i = 1; i <= 10; i++) expect(screen.getByText(`Name${i}`)).toBeInTheDocument();
    expect(screen.getByText("Name3").closest("li")).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByRole("button", { name: /boards ›/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: /^B\s*2 boards ›/ }));
    expect(onOpenTab).toHaveBeenCalledWith("b");
  });

  it("retries after an error", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ error: "x" }, 502)).mockResolvedValue(json({ metric: "globalRanking", createdAt: 0, top, around: [] }));
    vi.stubGlobal("fetch", f);
    render(<LbOverview meta={META} onOpenTab={() => {}} />);
    expect(await screen.findByText("Couldn't reach Idleon Toolbox.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Name1")).toBeInTheDocument();
  });
});

describe("HistoryChart", () => {
  const pt = (createdAt: number, globalRank: number, top10: number) => ({ createdAt, globalRank, top10, top100: 0 });
  it("asks for another visit with fewer than 2 points", () => {
    render(<HistoryChart points={[pt(1, 5, 2)]} />);
    expect(screen.getByText("Load this player again after the next refresh to start the history")).toBeInTheDocument();
  });
  it("draws two polylines with 3 points", () => {
    const { container } = render(<HistoryChart points={[pt(1, 9, 1), pt(2, 7, 2), pt(3, 7, 2)]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label");
    expect(screen.getByText("Global rank")).toBeInTheDocument();
    expect(screen.getByText("Boards in the top 10")).toBeInTheDocument();
  });
});
