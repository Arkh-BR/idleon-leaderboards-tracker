import { describe, expect, it } from "vitest";
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
    await expect(buildSnapshot(fake(meta, { failFrom: 150 }), null, "2026-11-15", 0)).rejects.toThrow("only 150 boards fetched");
  });
});

describe("renderSnapshot", () => {
  it("emits a typed LB_SNAPSHOT module", () => {
    const out = renderSnapshot({ generatedAt: "t", meta: makeMeta(1), boards: {} });
    expect(out).toContain("export const LB_SNAPSHOT: {");
    expect(out).toContain('"generatedAt": "t"');
  });
});
