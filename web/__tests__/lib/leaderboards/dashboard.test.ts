import { describe, it, expect } from "vitest";
import { tierCounts, type BoardRow } from "@/lib/leaderboards/dashboard";
import { printable } from "@/lib/leaderboards/metrics";
import type { MetaMetric, RankEntry } from "@/lib/leaderboards/types";

const metric = (notation: MetaMetric["notation"] = "default"): MetaMetric => ({
  key: "k", label: "K", notation, top: 0, topTies: 1, players: 10, maxed: false, section: "S",
});
const row = (r: number): BoardRow => ({ tab: "t", section: "S", m: metric(), e: { r, v: 1, p: 1, t: 1 } });

describe("dashboard helpers", () => {
  it("tierCounts uses the band edges 10 / 50 / 100 / 500", () => {
    const c = tierCounts([10, 11, 50, 51, 100, 101, 500, 501].map(row));
    expect(c.map((b) => [b.label, b.count])).toEqual([
      ["Top 10", 1],
      ["11–50", 2],
      ["51–100", 2],
      ["101–500", 2],
      ["500+", 1],
    ]);
  });

  it("printable rejects non-positive gaps and zero-rate seconds boards", () => {
    const e = (v: number): RankEntry => ({ r: 5, v, p: 1, t: 1 });
    expect(printable(1, metric(), e(0))).toBe(true);
    expect(printable(0, metric(), e(1))).toBe(false);
    expect(printable(1, metric("seconds"), e(0))).toBe(false);
  });
});
