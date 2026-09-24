import { describe, it, expect } from "vitest";
import { afkRate, AFK_NODES, AFK_ROOT } from "@/lib/arkh/stats/defs/afk-gains";
import { combineAfkPools } from "@/lib/arkh/computeAfk";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: 0,
  product: 0,
});
const pools = (o: { fight?: number[]; all?: number[]; multi?: number[]; rules?: number[] } = {}) => ({
  fight: pool(...(o.fight ?? [40])),
  all: pool(...(o.all ?? [])),
  multi: pool(...(o.multi ?? [0, 0])),
  rules: pool(...(o.rules ?? [1, 0, 1])),
});

describe("AFK Gains Rate combine", () => {
  it("is Σ/100 × (1 + arcane/100) × (1 + Etc92/100), with the base 40 inside Σ", () => {
    const { tree, total } = combineAfkPools(pools({ fight: [40, 60], all: [100], multi: [30, 400] }));
    expect(total).toBeCloseTo(2 * 1.3 * 5, 12);
    expect(tree).toMatchObject({ name: AFK_ROOT, fmt: "x", note: "max(1%, ·)" });
    expect(tree.children!.slice(0, 3).map((c) => c.name)).toEqual([AFK_NODES.pool, AFK_NODES.arcane, AFK_NODES.etc92]);
    expect(tree.children![0]).toMatchObject({ val: 2, fmt: "x", note: "Σ/100" });
    expect(tree.children![0].children).toHaveLength(3); // fight, then ALL
    expect(tree.children![1].val).toBeCloseTo(1.3, 12);
    expect(tree.children![2].val).toBe(5);
    expect(tree.children).toHaveLength(6); // + the three map rules
  });

  it("Clamworks multiplies by 0.2", () => {
    expect(combineAfkPools(pools({ fight: [40, 60], rules: [0.2, 0, 1] })).total).toBeCloseTo(0.2, 12);
  });

  it("the Cove replaces the whole rate", () => {
    expect(combineAfkPools(pools({ fight: [40, 960], multi: [30, 400], rules: [0.2, 1.67, 1] })).total).toBe(1.67);
  });

  it("never drops below 1%", () => {
    expect(combineAfkPools(pools({ fight: [40, -140] })).total).toBe(0.01);
  });

  it("a target that isn't a fight is 0, Cove or not", () => {
    expect(combineAfkPools(pools({ rules: [1, 0, 0] })).total).toBe(0);
    expect(combineAfkPools(pools({ rules: [1, 2, 0] })).total).toBe(0);
  });

  it("afkRate reproduces Markhe's map-14 rate from its parts", () => {
    expect(afkRate({ sum: 8503.975457682378, arcane: 0, etc92: 396.613269898924, clam: 1, cove: 0, type: 1 })).toBeCloseTo(422.31870591798446, 9);
  });
});
