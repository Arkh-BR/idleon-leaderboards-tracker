import { describe, it, expect } from "vitest";
import { groupFactorOf, groupedDescriptor, neutralValue, groupNote } from "@/lib/arkh/stats/defs/grouped";
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
});
