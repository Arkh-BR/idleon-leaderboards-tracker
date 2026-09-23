import { describe, it, expect } from "vitest";
import { combineCoinPools } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS, COIN_ROOT, groupFactor } from "@/lib/arkh/stats/defs/coin-multi";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: vals.reduce((a, b) => a + b, 0),
  product: 0,
});
const empty = (): Record<string, Pool> =>
  Object.fromEntries(COIN_GROUPS.map((g) => [g.key, pool()]));

describe("Coin Multi combine (N.js ArbitraryCode MonsterCash)", () => {
  it("applies each group shape", () => {
    expect(groupFactor("pct", 50)).toBe(1.5);
    expect(groupFactor("raw", 0.5)).toBe(1.5);
    expect(groupFactor("min4", 5)).toBe(5); // 1 + min(4, 5)
    expect(groupFactor("min4", 1.5)).toBe(2.5);
  });

  it("has 23 groups in game order, the last one additive", () => {
    expect(COIN_GROUPS).toHaveLength(23);
    expect(COIN_GROUPS.map((g) => g.key)).toEqual(
      Array.from({ length: 23 }, (_, i) => `g${String(i + 1).padStart(2, "0")}`)
    );
    expect(COIN_GROUPS[17].kind).toBe("raw"); // arena · friend · statue: no /100
    expect(COIN_GROUPS[22].kind).toBe("pct");
  });

  it("an empty save multiplies to 1", () => {
    const r = combineCoinPools(empty());
    expect(r.total).toBe(1);
    expect(r.tree.name).toBe(COIN_ROOT);
    expect(r.tree.children).toHaveLength(23);
  });

  it("multiplies every group factor and keeps the items", () => {
    const p = empty();
    p.g01 = pool(100, 50); // pct → 2.5
    p.g02 = pool(5); // min4 → 5
    p.g03 = pool(3); // raw → 4
    p.g18 = pool(0.5, 0, 1, 20694.16); // raw → 20696.66
    p.g23 = pool(10, 20); // pct → 1.3
    const r = combineCoinPools(p);
    expect(r.total).toBeCloseTo(2.5 * 5 * 4 * 20696.66 * 1.3, 6);
    expect(r.tree.children![0]).toMatchObject({ name: COIN_GROUPS[0].name, val: 2.5, fmt: "x" });
    expect(r.tree.children![0].children).toHaveLength(2);
  });
});
