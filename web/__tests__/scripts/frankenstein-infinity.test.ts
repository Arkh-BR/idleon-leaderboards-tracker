import { describe, it, expect } from "vitest";
import { node } from "@/lib/arkh/node";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import {
  accumulateOps,
  chooseOps,
  recomputeFrankenstein,
} from "../../scripts/_shared/frankenstein";
import { compMulti } from "@/lib/arkh/stats/systems/common/companions";

describe("frankenstein: Infinity must not verify a bogus op", () => {
  it("a node with an Infinity ×-child recomputes to its real value, not Infinity", () => {
    // Mirrors an uncapped compMulti node BEFORE the resolver fix: a
    // "Cap: Infinity" ×-child would make PROD(x) = Cap×Result = Infinity, and
    // the old approx() let Infinity<=Infinity "match".
    const tree = node("Drop Rate", 1.3, [
      node(
        "Crystal Glunko (Companion 168)",
        1.3,
        [
          node("Raw bonus", 1, null, { fmt: "+" }),
          node("Cap", Infinity, null, { fmt: "x" }),
          node("Result", 1.3, null, { fmt: "x" }),
        ],
        { fmt: "x" }
      ),
    ], { fmt: "x" });

    const bestFlat = flattenTree(tree);
    const opSets = new Map<string, Set<string>>();
    accumulateOps(tree, opSets);
    const { flat } = recomputeFrankenstein(tree, bestFlat, chooseOps(opSets));

    const p = Object.keys(flat).find((k) =>
      k.endsWith("Crystal Glunko (Companion 168)")
    )!;
    expect(Number.isFinite(flat[p])).toBe(true);
    expect(flat[p]).toBeCloseTo(1.3, 6);
  });
});

describe("compMulti: uncapped cap emits no Cap ×-child", () => {
  const ctx = { saveData: { companionIds: new Set([168]) } } as never;

  it("Crystal Glunko (168, uncapped) → Result 1.3, no Cap child", () => {
    const n = compMulti.resolve(168, ctx, [Infinity, 1, 0.3]);
    expect(n.val).toBeCloseTo(1.3, 6);
    expect((n.children || []).some((c) => c.name === "Cap")).toBe(false);
    expect((n.children || []).some((c) => c.name === "Result")).toBe(true);
  });

  it("a finite cap still shows the Cap child", () => {
    const n = compMulti.resolve(168, ctx, [1.3]); // finite cap
    expect((n.children || []).some((c) => c.name === "Cap")).toBe(true);
  });
});
