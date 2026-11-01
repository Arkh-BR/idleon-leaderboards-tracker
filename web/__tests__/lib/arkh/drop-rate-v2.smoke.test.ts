// CI smoke test — no private save. Every Drop Rate V2 source must resolve on an
// empty envelope (the dr2 switch throws on unknown ids).
import { describe, it, expect } from "vitest";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import { DR2_GROUPS, DR2_ROOT, DR2_VOTE_NAME } from "@/lib/arkh/stats/defs/drop-rate-v2";
import { DR2_CLASS_TALENTS } from "@/lib/arkh/stats/systems/dr2/dr2";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const EMPTY = () => ({ charNames: ["A"], data: {} as Record<string, unknown> });
const all = (n: ArkhNode): ArkhNode[] => [n, ...(n.children ?? []).flatMap(all)];

describe("Drop Rate V2 smoke test", () => {
  it("computes every source on an empty save", () => {
    const { tree, total } = computeArkhDropRateV2(EMPTY(), 0, 0);
    expect(tree.name).toBe(DR2_ROOT);
    expect(tree.children).toHaveLength(DR2_GROUPS.length);
    tree.children!.forEach((grp, i) => {
      expect(grp.children).toHaveLength(DR2_GROUPS[i].sources.length);
      // A replace header with nothing to replace is NaN by design (shown as "—").
      expect(Number.isNaN(grp.val), grp.name).toBe(DR2_GROUPS[i].kind === "replace");
      for (const n of grp.children!.flatMap(all)) expect(Number.isNaN(n.val), n.name).toBe(false);
    });
    expect(Number.isNaN(total)).toBe(false);
    // Not 1: two shared V1 resolvers read an empty save as non-zero — Star Signs
    // "drop" always counts Pirate Booty + Druipi Major (5 + 12), and Trove Sigil
    // reads a missing CauldronP2W as level 0 (tier 0 = 10). 1 + 27/100.
    expect(total).toBeCloseTo(1.27, 12);
  });

  // A name with " / " (the flat-tree path separator) would fall out of its group.
  it("the Biggest Gains model rebuilds the tree's total from the flat tree", () => {
    const { tree } = computeArkhDropRateV2(EMPTY(), 0, 0);
    for (const n of all(tree)) expect(n.name.includes(" / "), n.name).toBe(false);
    const t = groupedGainsModel(DR2_ROOT, DR2_GROUPS).totalFromFlat(flattenTree(tree));
    expect(Math.abs(t / tree.val - 1)).toBeLessThan(1e-12);
  });

  it("names each class talent with its (Talent n) suffix", () => {
    const names = all(computeArkhDropRateV2(EMPTY(), 0, 0).tree).map((n) => n.name);
    for (const id of DR2_CLASS_TALENTS) expect(names.some((n) => n.endsWith(`(Talent ${id})`)), String(id)).toBe(true);
  });

  it("the weekly vote counts only when vote 27 is the week's", () => {
    const vote = (env: object) => all(computeArkhDropRateV2(env, 0, 0).tree).find((n) => n.name === DR2_VOTE_NAME)!;
    expect(vote(EMPTY()).val).toBe(0);
    expect(vote({ ...EMPTY(), serverVars: { voteCategories: [27] } }).val).toBeGreaterThan(0);
  });

  it("the Cove replaces the total on map 216 in cavern 17 only", () => {
    const cavern = (c: number) => ({ charNames: ["A"], data: { Holes: JSON.stringify([[c]]) } });
    const cove = (env: object, map: number) => computeArkhDropRateV2(env, 0, map);
    // No Cove upgrades: Holes2("Cglunko_DR") = 1.
    expect(cove(cavern(17), 216).total).toBe(1);
    expect(cove(cavern(16), 216).total).toBeCloseTo(1.27, 12);
    expect(cove(cavern(17), 215).total).toBeCloseTo(1.27, 12);
  });
});
