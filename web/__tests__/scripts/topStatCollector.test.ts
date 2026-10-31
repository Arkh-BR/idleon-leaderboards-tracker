import { describe, it, expect } from "vitest";
import { buildFamilyReference, mergeBest, profileFlat, renderTopFiles, type StatCollectorConfig } from "@/scripts/_shared/topStatCollector";
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
    const { data, meta } = renderTopFiles(cfg, { beginner: { Root: 2, "Root / P": 2 } }, { "beginner:t35": { Root: 3 } }, { Maestro: ["beginner", "t35"] }, "beginner", { player: "p", char: "c", total: 9 }, 3, 20, "2026-09-24T00:00:00.000Z");
    expect(data).toContain("export const TOP_TEST_FAMILY_FLAT");
    expect(data).toContain("export const TOP_TEST_PROFILE_OVERRIDES");
    expect(data).toContain("export const TOP_TEST_CLASS_PROFILE");
    expect(data).toContain('export const TOP_TEST_DEFAULT_FAMILY = "beginner";');
    expect(data).toContain("export function topTestFlatForClass(classKey: string | null | undefined)");
    expect(meta).toContain('export const TOP_TEST_GENERATED_AT = "2026-09-24T00:00:00.000Z";');
    expect(meta).toContain("export const TOP_TEST_PLAYERS_SCANNED = 20;");
    expect(meta).toContain("export const TOP_TEST_HYPOTHETICAL_TOTAL = 3;");
  });

  it("the generated lookup picks the class's family, then its talent profile", () => {
    const { data } = renderTopFiles(cfg, { warrior: { Root: 4 }, mage: { Root: 7 } }, { "mage:t35": { Root: 8 } }, { Warrior: ["warrior", "base"], Wizard: ["mage", "t35"] }, "mage", null, 8, 20, "2026-10-31T00:00:00.000Z");
    const mod = new Function(data.replace(/^type .*$/m, "").replace(/export /g, "").replace(/: Readonly<[^=]*?>\s*=/g, " =").replace(/\(classKey: [^)]*\): FlatMap/, "(classKey)") + "\nreturn topTestFlatForClass;")();
    expect(mod("Warrior").Root).toBe(4); // warrior family, no talent override
    expect(mod("Wizard").Root).toBe(8); // mage family + its t35 profile
    expect(mod(null).Root).toBe(7); // no class → default (highest) family
  });

  it("keeps each class family's best apart — no warrior STR next to an archer's AGI", () => {
    // Cash-bubble shape: one pct group with an STR-scaled and an AGI-scaled source.
    const bub = (str: number, agi: number) => ({ p: pool(["STR bubble", str], ["AGI bubble", agi]) });
    const ref = buildFamilyReference({ ...cfg, groups: [GROUPS[1]], gated: [] }, {
      warrior: mergeBest(mergeBest(null, bub(300, 20)), bub(250, 25)),
      archer: mergeBest(null, bub(15, 280)),
    });
    expect(ref.familyFlats.warrior!["Root / P / STR bubble"]).toBe(300);
    expect(ref.familyFlats.warrior!["Root / P / AGI bubble"]).toBe(25); // not the archer's 280
    expect(ref.familyFlats.archer!["Root / P / AGI bubble"]).toBe(280);
    expect(ref.classProfile.Royal_Guardian).toEqual(["warrior", "base"]);
    expect(ref.classProfile.Wind_Walker).toEqual(["archer", "base"]);
    expect(ref.classProfile.Wizard).toBeUndefined(); // no mage pools → falls back to the default family
  });

  it("gates only talents some — not all — classes have", () => {
    const all = allClassKeys().length;
    for (const g of deriveGatedTalentsFor([35, 632])) {
      expect(g.owners.size).toBeGreaterThan(0);
      expect(g.owners.size).toBeLessThan(all);
    }
    expect(deriveGatedTalentsFor([35]).map((g) => g.id)).toEqual([35]); // Lucky Charms: Maestro tab (shared with Voidwalker), not every class
    expect(deriveGatedTalentsFor([632])).toEqual([]); // star talent, every class
  });
});
