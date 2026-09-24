import { describe, it, expect } from "vitest";
import { mergeBest, profileFlat, renderTopFiles, type StatCollectorConfig } from "@/scripts/_shared/topStatCollector";
import { deriveGatedTalentsFor, allClassKeys } from "@/scripts/_shared/classGating";
import { groupedDescriptor } from "@/lib/arkh/stats/defs/grouped";
import { combineStatPools } from "@/lib/arkh/computeStat";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const GROUPS = [
  { key: "m", name: "M", kind: "mult" as const, sources: ["t", "u"] },
  { key: "p", name: "P", kind: "pct" as const, sources: ["v"] },
];
const desc = groupedDescriptor({ id: "t", name: "Root", scope: "character", category: "test", system: "none", groups: GROUPS });
const cfg = {
  label: "Test Multi",
  root: "Root",
  groups: GROUPS,
  combine: (p: Record<string, Pool>) => combineStatPools(desc, p),
  constPrefix: "TOP_TEST",
  flatForClassFn: "topTestFlatForClass",
  scriptName: "scripts/update-top-test.ts",
} as unknown as StatCollectorConfig;
const pool = (...items: Array<[string, number]>): Pool => ({
  items: items.map(([name, val]) => ({ name, val, children: [{ name: "d", val }] })),
  sum: 0,
  product: 0,
});

describe("shared Observed Max collector", () => {
  it("keeps the best value per source position", () => {
    const a = mergeBest(null, { m: pool(["X (Talent 35)", 2], ["Y", 5]), p: pool(["Z", 10]) });
    const b = mergeBest(a, { m: pool(["X (Talent 35)", 3], ["Y", 1]), p: pool(["Z", 4]) });
    expect(b.m.items.map((i) => i.val)).toEqual([3, 5]);
    expect(b.p.items.map((i) => i.val)).toEqual([10]);
  });

  it("zeroes a gated talent with the group's neutral value and drops its subtree", () => {
    const best = { m: pool(["X (Talent 35)", 3], ["Y", 5]), p: pool(["Lucky (Talent 35)", 10], ["Z", 4]) };
    const flat = profileFlat(cfg, best, [35]);
    expect(flat["Root / M / X (Talent 35)"]).toBe(1); // mult → 1
    expect(flat["Root / P / Lucky (Talent 35)"]).toBe(0); // pct → 0
    expect(flat["Root / M / X (Talent 35) / d"]).toBeUndefined();
    expect(flat["Root"]).toBeCloseTo(5 * 1.04, 12);
  });

  it("renders the generated module with the stat's names", () => {
    const { data, meta } = renderTopFiles(cfg, { Root: 2, "Root / P": 2 }, { t35: { Root: 3 } }, { Maestro: "t35" }, { player: "p", char: "c", total: 9 }, 3, 20, "2026-09-24T00:00:00.000Z");
    expect(data).toContain("export const TOP_TEST_FLAT");
    expect(data).toContain("export const TOP_TEST_PROFILE_OVERRIDES");
    expect(data).toContain("export const TOP_TEST_CLASS_PROFILE");
    expect(data).toContain("export function topTestFlatForClass(classKey: string | null | undefined)");
    expect(meta).toContain('export const TOP_TEST_GENERATED_AT = "2026-09-24T00:00:00.000Z";');
    expect(meta).toContain("export const TOP_TEST_PLAYERS_SCANNED = 20;");
    expect(meta).toContain("export const TOP_TEST_HYPOTHETICAL_TOTAL = 3;");
  });

  it("gates only talents some — not all — classes have", () => {
    const all = allClassKeys().length;
    for (const g of deriveGatedTalentsFor([35, 632])) {
      expect(g.owners.size).toBeGreaterThan(0);
      expect(g.owners.size).toBeLessThan(all);
    }
    expect(deriveGatedTalentsFor([35]).map((g) => g.id)).toEqual([35]); // Lucky Charms: Maestro tab only
    expect(deriveGatedTalentsFor([632])).toEqual([]); // star talent, every class
  });
});
