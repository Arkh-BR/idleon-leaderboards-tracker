import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSnapshot, renderSnapshot } from "../../scripts/update-lb-snapshot";
import type { LbMeta } from "../../lib/leaderboards/types";

const metric = (key: string) => ({ key, label: key, notation: "default" as const, top: 1, topTies: 1, players: 100, maxed: false, section: "S" });
function makeMeta(n: number): LbMeta {
  const keys = Array.from({ length: n }, (_, i) => `m${i}`);
  return {
    createdAt: 1,
    totalPlayers: 5,
    tabs: [
      { key: "a", label: "A", sections: [{ name: "S", metrics: keys.slice(0, 100).map(metric) }] },
      { key: "b", label: "B", sections: [{ name: "S", metrics: keys.slice(100, 200).map(metric) }] },
      { key: "c", label: "C", sections: [{ name: "S", metrics: keys.slice(200).map(metric) }] },
    ],
  };
}
const rows = (vals: number[]) => vals.map((value, i) => ({ mainChar: `p${i}`, value, rank: i + 1 }));
const desc = Array.from({ length: 100 }, (_, i) => 1000 - i);
const asc = Array.from({ length: 100 }, (_, i) => 1 + i);

function fake(meta: LbMeta, opts: { failFrom?: number; asc?: string } = {}) {
  return async (url: string) => {
    if (url.endsWith("/leaderboards/meta")) return meta;
    const key = new URL(url).searchParams.get("metric")!;
    if (opts.failFrom !== undefined && Number(key.slice(1)) >= opts.failFrom) throw new Error("boom");
    return { metric: key, createdAt: 1, top: rows(key === opts.asc ? asc : desc), around: [] };
  };
}

describe("buildSnapshot", () => {
  beforeEach(() => void vi.spyOn(console, "log").mockImplementation(() => {}));
  afterEach(() => void vi.restoreAllMocks());

  it("computes cutoffs, lowerIsBetter and firstSeen", async () => {
    const meta = makeMeta(220);
    const previous = { generatedAt: "x", meta, boards: { m0: { top10: 1, top100: 1, lowerIsBetter: false, firstSeen: "2026-01-01" } } };
    const s = await buildSnapshot(fake(meta, { asc: "m1" }), previous, "2026-11-15", 0);
    expect(s.meta).toEqual(meta);
    expect(s.boards.m0).toEqual({ top10: 991, top100: 901, lowerIsBetter: false, firstSeen: "2026-01-01" });
    expect(s.boards.m1.lowerIsBetter).toBe(true);
    expect(s.boards.m1.top10).toBe(10);
    expect(s.boards.m2.firstSeen).toBe("2026-11-15");
    expect(Object.keys(s.boards)).toHaveLength(220);
  });

  it("throws when fewer than 200 boards come back", async () => {
    const meta = makeMeta(220);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(buildSnapshot(fake(meta, { failFrom: 150 }), null, "2026-11-15", 0)).rejects.toThrow("only 150 boards fetched");
    vi.restoreAllMocks();
  });
});

describe("retry and carry-forward", () => {
  afterEach(() => void vi.restoreAllMocks());
  it("retries a failed metric once", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const meta = makeMeta(220);
    const base = fake(meta);
    const calls: Record<string, number> = {};
    const f = async (url: string) => {
      const key = new URL(url).searchParams.get("metric");
      if (key) calls[key] = (calls[key] ?? 0) + 1;
      if (key === "m5" && calls[key] === 1) throw new Error("flaky");
      return base(url);
    };
    const s = await buildSnapshot(f, null, "2026-11-15", 0);
    expect(calls.m5).toBe(2);
    expect(s.boards.m5.top10).toBe(991);
  });

  it("carries a twice-failing metric forward and warns", async () => {
    const meta = makeMeta(220);
    const old = { top10: 7, top100: 3, lowerIsBetter: false, firstSeen: "2026-01-01" };
    const previous = { generatedAt: "x", meta, boards: { m9: old } };
    const base = fake(meta);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const f = async (url: string) => {
      if (url.includes("metric=m9&")) throw new Error("down");
      return base(url);
    };
    const s = await buildSnapshot(f, previous, "2026-11-15", 0);
    expect(s.boards.m9).toEqual(old);
    expect(warn).toHaveBeenCalledWith("· m9: down");
    expect(log).toHaveBeenCalledWith("fetched 219, carried forward 1, missing 0");
    warn.mockRestore();
    log.mockRestore();
  });
});

describe("renderSnapshot", () => {
  it("emits a typed LB_SNAPSHOT module", () => {
    const out = renderSnapshot({ generatedAt: "t", meta: makeMeta(1), boards: {} });
    expect(out).toContain("export const LB_SNAPSHOT: {");
    expect(out).toContain('"generatedAt": "t"');
  });
});
