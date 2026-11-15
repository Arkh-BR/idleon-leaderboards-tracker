import { beforeEach, describe, expect, it } from "vitest";
import { sectionStrength } from "@/lib/leaderboards/sections";
import { sinceLastVisit, appendHistory, loadHistory } from "@/lib/leaderboards/history";
import { headToHead } from "@/lib/leaderboards/headToHead";
import type { LbMeta, LbPlayer, RankEntry } from "@/lib/leaderboards/types";

const e = (r: number, p = 1): RankEntry => ({ r, v: 0, p, t: 0 });
const metric = (key: string) => ({ key, label: key, notation: "default" as const, top: 0, topTies: 0, players: 0, maxed: false, section: "" });
const meta: LbMeta = {
  createdAt: 1, totalPlayers: 100,
  tabs: [
    { key: "t1", label: "T1", sections: [
      { name: "S1", metrics: ["a", "b", "c", "d"].map(metric) },
      { name: "Empty", metrics: [metric("zz")] },
    ] },
    { key: "t2", label: "T2", sections: [{ name: "S2", metrics: ["x", "y", "z"].map(metric) }] },
  ],
};
const pl = (createdAt: number, rank: number, ranks: Record<string, RankEntry>): LbPlayer => ({
  createdAt, player: { mainChar: "A", rank, compositeScore: 0, profileAccess: "", mainClass: 0, bestMetrics: [] }, ranks,
});

beforeEach(() => localStorage.clear());

describe("sectionStrength", () => {
  it("median top % in meta order, omitting unranked sections", () => {
    const out = sectionStrength({ a: e(1, 1), b: e(1, 5), c: e(1, 3), d: e(1, 9), x: e(1, 2), z: e(1, 4) }, meta);
    expect(out).toEqual([
      { tab: "t1", section: "S1", medianTopPct: 4, boards: 4 },
      { tab: "t2", section: "S2", medianTopPct: 3, boards: 2 },
    ]);
  });
  it("odd count takes the middle", () => {
    expect(sectionStrength({ a: e(1, 7), b: e(1, 1), c: e(1, 2) }, meta)[0].medianTopPct).toBe(2);
  });
});

describe("sinceLastVisit", () => {
  it("first visit: null baseline, stored", () => {
    const cur = pl(10, 50, { a: e(5) });
    expect(sinceLastVisit("Foo", cur)).toEqual({ baseline: null, moves: {}, globalMove: 0 });
    expect(JSON.parse(localStorage.getItem("idleon-leaderboards.v4.baseline.foo")!)).toEqual({ createdAt: 10, ranks: { a: 5 }, globalRank: 50 });
  });
  it("same createdAt: same moves, store untouched", () => {
    sinceLastVisit("Foo", pl(10, 50, { a: e(5) }));
    const raw = localStorage.getItem("idleon-leaderboards.v4.baseline.foo");
    const cur = pl(10, 40, { a: e(3) });
    const r1 = sinceLastVisit("Foo", cur);
    expect(r1.moves).toEqual({ a: 2 });
    expect(r1.globalMove).toBe(10);
    expect(sinceLastVisit("Foo", cur)).toEqual(r1);
    expect(localStorage.getItem("idleon-leaderboards.v4.baseline.foo")).toBe(raw);
  });
  it("newer createdAt: moves vs old baseline, then replaces it", () => {
    sinceLastVisit("Foo", pl(10, 50, { a: e(5) }));
    const r = sinceLastVisit("Foo", pl(20, 60, { a: e(8) }));
    expect(r.moves).toEqual({ a: -3 });
    expect(r.globalMove).toBe(-10);
    expect(r.baseline?.createdAt).toBe(10);
    expect(JSON.parse(localStorage.getItem("idleon-leaderboards.v4.baseline.foo")!).createdAt).toBe(20);
  });
  it("corrupt storage is treated as absent", () => {
    localStorage.setItem("idleon-leaderboards.v4.baseline.foo", "{nope");
    expect(sinceLastVisit("Foo", pl(10, 50, {})).baseline).toBeNull();
  });
});

describe("history", () => {
  it("counts top10/top100 and dedups by createdAt", () => {
    const cur = pl(10, 7, { a: e(1), b: e(10), c: e(11), d: e(100), x: e(101) });
    expect(appendHistory("Foo", cur)).toEqual([{ createdAt: 10, globalRank: 7, top10: 2, top100: 4 }]);
    expect(appendHistory("Foo", cur)).toHaveLength(1);
    expect(appendHistory("Foo", pl(5, 7, {}))).toHaveLength(1);
  });
  it("caps at 365", () => {
    for (let i = 1; i <= 370; i++) appendHistory("Foo", pl(i, i, {}));
    const h = loadHistory("Foo");
    expect(h).toHaveLength(365);
    expect(h[0].createdAt).toBe(6);
    expect(h[364].createdAt).toBe(370);
  });
  it("loadHistory: empty or corrupt gives []", () => {
    expect(loadHistory("Foo")).toEqual([]);
    localStorage.setItem("idleon-leaderboards.v4.history.foo", "xx");
    expect(loadHistory("Foo")).toEqual([]);
  });
});

describe("headToHead", () => {
  it("wins, losses, tie, and skips metrics missing on one side", () => {
    const a = pl(1, 1, { m1: e(1), m2: e(9), m3: e(5), only: e(1) });
    const b = pl(1, 2, { m1: e(2), m2: e(3), m3: e(5) });
    const r = headToHead(a, b);
    expect(r).toMatchObject({ wins: 1, losses: 1, ties: 1 });
    expect(r.rows.map((x) => [x.metric, x.winner])).toEqual([["m1", "a"], ["m2", "b"], ["m3", "tie"]]);
  });
});
