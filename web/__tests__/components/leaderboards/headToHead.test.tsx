import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import PlayerPicker from "@/components/leaderboards/PlayerPicker";
import HeadToHead, { addRecent, RECENT_KEY } from "@/components/leaderboards/HeadToHead";
import LbDashboard from "@/components/leaderboards/LbDashboard";
import type { LbBoard, LbMeta, LbPlayer, MetaMetric, RankEntry } from "@/lib/leaderboards/types";

vi.mock("@/lib/leaderboards/snapshot", () => ({
  LB_SNAPSHOT: { generatedAt: "2026-11-15T00:00:00Z", meta: { createdAt: 0, totalPlayers: 0, tabs: [] }, boards: {} },
}));

const m = (key: string, label: string, section: string): MetaMetric => ({
  key, label, notation: "default", top: 0, topTies: 1, players: 100, maxed: false, section,
});
const META: LbMeta = {
  createdAt: 0,
  totalPlayers: 100,
  tabs: [
    { key: "account", label: "Account", sections: [{ name: "Totals", metrics: [m("a", "Alpha", "Totals"), m("b", "Beta", "Totals")] }] },
    { key: "skills", label: "Skills", sections: [{ name: "Mining", metrics: [m("c", "Gamma", "Mining")] }] },
  ],
};
const e = (r: number): RankEntry => ({ r, v: 1, p: 1, t: 1 });
const player = (mainChar: string, ranks: Record<string, RankEntry>): LbPlayer => ({
  createdAt: 1,
  player: { mainChar, rank: 9, compositeScore: 0, profileAccess: "public", mainClass: 0, bestMetrics: [] },
  ranks,
});
const ME = player("Foo", { a: e(5), b: e(20), c: e(7), z: e(1) }); // z: only mine, doesn't count
const DRAGAMI = player("Dragami", { a: e(9), b: e(3), c: e(7), y: e(1) }); // a win, b loss, c tie

const BOARD: LbBoard = {
  metric: "globalRanking",
  createdAt: 1,
  top: Array.from({ length: 12 }, (_, i) => ({ mainChar: `Top${i + 1}`, value: 1e7 - i, rank: i + 1 })),
  around: [
    { mainChar: "Dragami", value: 1500, rank: 8 },
    { mainChar: "Foo", value: 1000, rank: 9 },
    { mainChar: "Low", value: 400, rank: 10 },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(routes: (url: string) => Response | Promise<Response> | undefined) {
  const f = vi.fn(async (url: string) => routes(url) ?? json({ error: "nope" }, 404));
  vi.stubGlobal("fetch", f);
  return f;
}

const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => c[0] as string);
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// IT's /leaderboards/names answers { players: [{ mainChar, rank }] } (live-checked 2026-11-16).
const P = (...names: string[]) => names.map((mainChar, i) => ({ mainChar, rank: i + 1 }));

describe("PlayerPicker", () => {
  it("looks up names once, 300 ms after the last keystroke, and only from 2 characters", async () => {
    vi.useFakeTimers();
    const f = stubFetch((u) => (u.startsWith("/api/lb/names") ? json({ players: P("Dragami", "Dragon") }) : undefined));
    render(<PlayerPicker value="" onPick={() => {}} />);
    const input = screen.getByLabelText("Player name");
    fireEvent.change(input, { target: { value: "d" } });
    await wait(400);
    expect(f).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "dr" } });
    await wait(200);
    fireEvent.change(input, { target: { value: "dra" } });
    await wait(299);
    expect(f).not.toHaveBeenCalled();
    await wait(1);
    expect(urls(f)).toEqual(["/api/lb/names?q=dra"]);
    await flush();
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.querySelector("[data-name]")?.textContent)).toEqual(["Dragami", "Dragon"]);
    expect(opts[0]).toHaveTextContent("global #1");
  });

  it("↑/↓/Enter picks a suggestion; Enter with none highlighted submits the typed text; Escape closes", async () => {
    vi.useFakeTimers();
    stubFetch(() => json({ players: P("Dragami", "Dragon") }));
    const onPick = vi.fn();
    render(<PlayerPicker value="" onPick={onPick} />);
    const input = screen.getByLabelText("Player name");
    fireEvent.change(input, { target: { value: "dra" } });
    await wait(300);
    await flush();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Dragami" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenLastCalledWith("Dragami");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveValue("Dragami");

    fireEvent.change(input, { target: { value: "drag" } });
    await wait(300);
    await flush();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenLastCalledWith("drag");
  });

  it("ignores a stale response once the query has changed", async () => {
    vi.useFakeTimers();
    let slow!: (r: Response) => void;
    stubFetch((u) => (u.endsWith("q=dra") ? new Promise<Response>((r) => (slow = r)) : json({ players: P("Draco") })));
    render(<PlayerPicker value="" onPick={() => {}} />);
    const input = screen.getByLabelText("Player name");
    fireEvent.change(input, { target: { value: "dra" } });
    await wait(300);
    fireEvent.change(input, { target: { value: "drac" } });
    await wait(300);
    await flush();
    slow(json({ players: P("Dragami") }));
    await flush();
    expect(screen.getAllByRole("option").map((o) => o.querySelector("[data-name]")?.textContent)).toEqual(["Draco"]);
  });

  it("while busy, Enter, a suggestion click and a chip don't pick", async () => {
    vi.useFakeTimers();
    stubFetch(() => json({ players: P("Dragami") }));
    const onPick = vi.fn();
    render(<PlayerPicker value="" onPick={onPick} busy chips={[{ label: "#8 Dragami", name: "Dragami" }]} />);
    const input = screen.getByLabelText("Player name");
    fireEvent.change(input, { target: { value: "dra" } });
    await wait(300);
    await flush();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "Dragami" }));
    fireEvent.click(screen.getByRole("button", { name: "#8 Dragami" }));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });

  it("chips pick their name", () => {
    const onPick = vi.fn();
    render(<PlayerPicker value="" onPick={onPick} chips={[{ label: "#8 Dragami", name: "Dragami" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "#8 Dragami" }));
    expect(onPick).toHaveBeenCalledWith("Dragami");
  });
});

describe("HeadToHead", () => {
  it("choosing a suggestion fetches that player and shows W/L/T and the board table", async () => {
    vi.useFakeTimers();
    const f = stubFetch((u) =>
      u.startsWith("/api/lb/names") ? json({ players: P("Dragami") }) : u === "/api/lb/player?name=Dragami" ? json(DRAGAMI) : undefined,
    );
    render(<HeadToHead me={ME} meta={META} />);
    fireEvent.change(screen.getByLabelText("Compare with"), { target: { value: "dra" } });
    await wait(300);
    await flush();
    fireEvent.click(screen.getByRole("option", { name: "Dragami" }));
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    await flush();
    expect(urls(f)).toContain("/api/lb/player?name=Dragami");
    expect(screen.getByText("1 wins · 1 losses · 1 ties")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell").map((c) => c.textContent));
    expect(rows).toEqual([["Alpha", "#5", "#9"], ["Beta", "#20", "#3"], ["Gamma", "#7", "#7"]]);
    expect(within(screen.getAllByRole("row")[1]).getByText("#5")).toHaveClass("text-emerald-300");
    expect(within(screen.getAllByRole("row")[2]).getByText("#3")).toHaveClass("text-emerald-300");

    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "skills/Mining" } });
    expect(screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["Gamma"]);
    expect(JSON.parse(localStorage.getItem(RECENT_KEY)!)).toEqual(["Dragami"]);
  });

  it("shows the route's error", async () => {
    stubFetch(() => json({ error: "Player not found. Check the name or make the profile public on Idleon Toolbox." }, 404));
    render(<HeadToHead me={ME} meta={META} initial="Ghost" />);
    expect(await screen.findByText(/Player not found/)).toBeInTheDocument();
    expect(localStorage.getItem(RECENT_KEY)).toBeNull();
  });

  it("the recent list keeps 8, newest first, deduped case-insensitively", async () => {
    expect(addRecent(["a", "B", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(addRecent(["1", "2", "3", "4", "5", "6", "7", "8"], "9")).toEqual(["9", "1", "2", "3", "4", "5", "6", "7"]);

    localStorage.setItem(RECENT_KEY, JSON.stringify(["P1", "P2", "Dragami", "P4", "P5", "P6", "P7", "P8"]));
    stubFetch((u) => (u.includes("name=dragami") ? json(DRAGAMI) : undefined));
    render(<HeadToHead me={ME} meta={META} initial="dragami" />);
    await screen.findByText("1 wins · 1 losses · 1 ties");
    expect(JSON.parse(localStorage.getItem(RECENT_KEY)!)).toEqual(["dragami", "P1", "P2", "P4", "P5", "P6", "P7", "P8"]);
    expect(screen.getByRole("button", { name: "P8" })).toBeInTheDocument(); // recent chips
  });
});

describe("Dashboard: global rivals → head-to-head", () => {
  it("fetches globalRanking around once; a rival click opens the comparison", async () => {
    const f = stubFetch((u) =>
      u === "/api/lb/board?metric=globalRanking&around=Foo" ? json(BOARD) : u === "/api/lb/player?name=Dragami" ? json(DRAGAMI) : undefined,
    );
    render(<LbDashboard meta={META} player={ME} snapshot={null} onSaveSnapshot={() => {}} history={[]} />);
    const rivals = await screen.findByRole("region", { name: "Global rivals" });
    const dragami = await within(rivals).findByRole("button", { name: /Dragami/ });
    expect(dragami).toHaveTextContent("#8");
    expect(dragami).toHaveTextContent("+500");
    expect(within(rivals).getByRole("button", { name: /Low/ })).toHaveTextContent("−600");
    expect(within(rivals).queryByRole("button", { name: /Foo/ })).toBeNull();
    expect(within(rivals).queryByText(/beats you/)).toBeNull();

    const h2h = screen.getByRole("region", { name: "Head-to-head" });
    expect(within(h2h).getByRole("button", { name: "#1 Top1" })).toBeInTheDocument(); // global top 10 chips
    expect(within(h2h).getByRole("button", { name: "#10 Top10" })).toBeInTheDocument();
    expect(within(h2h).queryByRole("button", { name: "#11 Top11" })).toBeNull();

    fireEvent.click(dragami);
    expect(await within(screen.getByRole("region", { name: "Head-to-head" })).findByText("1 wins · 1 losses · 1 ties")).toBeInTheDocument();
    expect(within(rivals).getByText("beats you on 1")).toBeInTheDocument();
    expect(urls(f).filter((u) => u.startsWith("/api/lb/board"))).toHaveLength(1);
  });
});
