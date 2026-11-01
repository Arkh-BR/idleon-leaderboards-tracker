import { describe, it, expect } from "vitest";
import { groupFactorOf, groupedDescriptor, neutralValue, groupNote, applyGroupStep } from "@/lib/arkh/stats/defs/grouped";
import { combineStatPools } from "@/lib/arkh/computeStat";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: 0,
  product: 0,
});

describe("grouped descriptors", () => {
  it("computes each kind's factor", () => {
    expect(groupFactorOf({ kind: "pct" }, [30, 20])).toBe(1.5);
    expect(groupFactorOf({ kind: "raw" }, [0.25, 0.25])).toBe(1.5);
    expect(groupFactorOf({ kind: "min4" }, [3, 3])).toBe(5);
    expect(groupFactorOf({ kind: "mult" }, [2, 3, 1.5])).toBe(9);
    expect(groupFactorOf({ kind: "mult", max1: true }, [0.5, 1])).toBe(1);
    expect(groupFactorOf({ kind: "mult" }, [0.5, 1])).toBe(0.5);
    expect(groupFactorOf({ kind: "mult" }, [])).toBe(1);
    expect(groupFactorOf({ kind: "pct" }, [])).toBe(1);
  });

  it("treats NaN as the kind's neutral element", () => {
    expect(groupFactorOf({ kind: "pct" }, [NaN, 50])).toBe(1.5);
    expect(groupFactorOf({ kind: "mult" }, [NaN, 4])).toBe(4);
    expect(neutralValue("mult")).toBe(1);
    expect(neutralValue("pct")).toBe(0);
    expect(neutralValue("min4")).toBe(0);
  });

  it("notes each kind", () => {
    expect(groupNote({ kind: "pct" })).toBe("× (1 + Σ/100)");
    expect(groupNote({ kind: "raw" })).toBe("× (1 + Σ)");
    expect(groupNote({ kind: "min4" })).toBe("× (1 + min(4, Σ))");
    expect(groupNote({ kind: "mult" })).toBe("× Π");
    expect(groupNote({ kind: "mult", max1: true })).toBe("× max(1, Π)");
  });

  it("multiplies the groups in order and keeps the items", () => {
    const desc = groupedDescriptor({
      id: "t",
      name: "Test",
      scope: "character",
      category: "test",
      system: "none",
      groups: [
        { key: "a", name: "A", kind: "mult", max1: true, sources: ["x", "y"] },
        { key: "b", name: "B", kind: "pct", sources: ["z"] },
      ],
    });
    expect(desc.pools.a).toEqual([{ system: "none", id: "x" }, { system: "none", id: "y" }]);
    const r = combineStatPools(desc, { a: pool(2, 3), b: pool(50) });
    expect(r.total).toBe(9);
    expect(r.tree.name).toBe("Test");
    expect(r.tree.fmt).toBe("x");
    expect(r.tree.children![0]).toMatchObject({ name: "A", val: 6, fmt: "x", note: "× max(1, Π)" });
    expect(r.tree.children![1]).toMatchObject({ name: "B", val: 1.5, note: "× (1 + Σ/100)" });
    expect(r.tree.children![0].children).toHaveLength(2);
  });

  it("add / replace neutrals and notes", () => {
    expect(neutralValue("add")).toBe(0);
    expect(neutralValue("replace")).toBeNaN();
    expect(groupNote({ kind: "add" })).toBe("+ Σ");
    expect(groupNote({ kind: "add", below: 5 })).toBe("+ Σ (only below 5, capped at 5)");
    expect(groupNote({ kind: "replace" })).toBe("replaces the total");
  });

  it("applyGroupStep: multiplicative kinds multiply, add adds, replace swaps", () => {
    expect(applyGroupStep({ kind: "pct" }, [50], 2)).toBe(3);
    expect(applyGroupStep({ kind: "mult", max1: true }, [0.5], 4)).toBe(4);
    expect(applyGroupStep({ kind: "add" }, [1, 2, NaN], 3)).toBe(6);
    expect(applyGroupStep({ kind: "add" }, [], 3)).toBe(3);
    expect(applyGroupStep({ kind: "replace" }, [NaN, 9, 4], 3)).toBe(9);
    expect(applyGroupStep({ kind: "replace" }, [0], 3)).toBe(0); // 0 is a finite replacement
    expect(applyGroupStep({ kind: "replace" }, [NaN], 3)).toBe(3);
    expect(applyGroupStep({ kind: "replace" }, [], 3)).toBe(3);
  });

  it("add below N: only tops up a total under N, capped at N", () => {
    const chip = { kind: "add", below: 5 } as const;
    expect(applyGroupStep(chip, [0.2], 4.95)).toBe(5);
    expect(applyGroupStep(chip, [0.02], 4.95)).toBeCloseTo(4.97, 12);
    expect(applyGroupStep(chip, [0.2], 5)).toBe(5);
    expect(applyGroupStep(chip, [0.2], 6)).toBe(6);
  });

  const mixed = (below?: number) =>
    groupedDescriptor({
      id: "m",
      name: "Mixed",
      scope: "character",
      category: "test",
      system: "none",
      groups: [
        { key: "a", name: "A", kind: "pct", sources: ["a1"] },
        { key: "b", name: "B", kind: "add", sources: ["b1"] },
        { key: "c", name: "C", kind: "mult", sources: ["c1"] },
        { key: "d", name: "D", kind: "add", below, sources: ["d1"] },
        { key: "e", name: "E", kind: "replace", sources: ["e1"] },
      ],
    });

  it("runs add / mult steps in order: (1.5 + 2) × 1.2", () => {
    const d = mixed();
    const r = combineStatPools(d, { a: pool(50), b: pool(2), c: pool(1.2), d: pool(), e: pool() });
    expect(r.total).toBeCloseTo(4.2, 12);
    expect(r.tree.children!.map((c) => c.val)).toEqual([1.5, 2, 1.2, 0, NaN]);
    expect(r.tree.children![1]).toMatchObject({ name: "B", note: "+ Σ" });
    expect(r.tree.children![4]).toMatchObject({ name: "E", note: "replaces the total" });
  });

  it("add below 5 in a chain: 4.95 + 0.2 → 5, 6 stays 6", () => {
    const d = mixed(5);
    const run = (a: number) => combineStatPools(d, { a: pool(a), b: pool(0), c: pool(1), d: pool(0.2), e: pool() }).total;
    expect(run(395)).toBeCloseTo(5, 12); // 1 + 3.95 = 4.95 → 5
    expect(run(500)).toBeCloseTo(6, 12); // 1 + 5 = 6 → untouched
  });

  it("replace: a finite source replaces the total, NaN leaves it", () => {
    const d = mixed();
    const base = { a: pool(100), b: pool(0), c: pool(1), d: pool() };
    const hit = combineStatPools(d, { ...base, e: pool(7) });
    expect(hit.total).toBe(7);
    expect(hit.tree.children![4].val).toBe(7);
    const miss = combineStatPools(d, { ...base, e: pool(NaN) });
    expect(miss.total).toBe(2);
    expect(miss.tree.children![4].val).toBeNaN();
  });
});
