import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BoardTable from "@/components/leaderboards/BoardTable";
import type { LbPlayer, MetaMetric, MetaTab } from "@/lib/leaderboards/types";

vi.mock("@/lib/leaderboards/snapshot", () => ({
  LB_SNAPSHOT: { generatedAt: "", meta: { createdAt: 0, totalPlayers: 0, tabs: [] }, boards: {} },
}));

const m = (key: string, label: string): MetaMetric => ({
  key,
  label,
  notation: "default",
  top: 0,
  topTies: 1,
  players: 10,
  maxed: false,
  section: "S",
});
const TAB: MetaTab = { key: "t", label: "T", sections: [{ name: "S", metrics: [m("alpha", "Alpha"), m("beta", "Beta")] }] };
const pl = (name: string): LbPlayer => ({
  createdAt: 1,
  player: { mainChar: name, rank: 1, compositeScore: 0, profileAccess: "public", mainClass: 0, bestMetrics: [] },
  ranks: {},
});

// Echoes the requested player back as the only "around" row so stale rows are detectable.
const stub = () => {
  const f = vi.fn(async (url: string) => {
    const who = new URL(url, "http://x").searchParams.get("around") ?? "nobody";
    return {
      ok: true,
      json: async () => ({
        metric: "m",
        createdAt: 0,
        top: [{ mainChar: "Top1", value: 9, rank: 1 }],
        around: [{ mainChar: who, value: 5, rank: 7 }],
      }),
    };
  });
  vi.stubGlobal("fetch", f);
  return f;
};
const ui = (player: string, hideAnon = false) => <BoardTable tab={TAB} player={pl(player)} moves={{}} sort="it" hideAnon={hideAnon} />;
const toggleBtn = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

afterEach(() => vi.unstubAllGlobals());

describe("BoardTable expansion", () => {
  it("fetches once; collapse hides, re-open shows without refetch", async () => {
    const f = stub();
    render(ui("Foo"));
    const b = toggleBtn("Alpha");
    expect(b).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "true");
    const cellOf = async () => (await screen.findByText("Foo")).closest("table")!.closest("tbody")!;
    expect(await cellOf()).not.toHaveAttribute("hidden");
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "false");
    expect(await cellOf()).toHaveAttribute("hidden");
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(await cellOf()).not.toHaveAttribute("hidden");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refetches an open expansion on player / hideAnon change; a collapsed one stays quiet", async () => {
    const f = stub();
    const { rerender } = render(ui("Foo"));
    fireEvent.click(toggleBtn("Alpha"));
    await screen.findByText("Foo");
    fireEvent.click(toggleBtn("Beta"));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    fireEvent.click(toggleBtn("Beta")); // collapse

    rerender(ui("Bar"));
    await screen.findByText("Bar");
    expect(screen.queryByText("Foo")).toBeNull();
    expect(f).toHaveBeenCalledTimes(3); // only Alpha refetched
    expect(f.mock.calls[2][0]).toBe("/api/lb/board?metric=alpha&around=Bar");

    rerender(ui("Bar", true));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(4));
    expect(f.mock.calls[3][0]).toBe("/api/lb/board?metric=alpha&around=Bar&public=1");

    fireEvent.click(toggleBtn("Beta")); // re-open: fetches its new key now
    await waitFor(() => expect(f).toHaveBeenCalledTimes(5));
    expect(f.mock.calls[4][0]).toBe("/api/lb/board?metric=beta&around=Bar&public=1");
  });
});
