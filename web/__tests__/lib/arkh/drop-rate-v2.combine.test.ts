import { describe, it, expect } from "vitest";
import { combineDropRateV2Pools } from "@/lib/arkh/computeDropRateV2";
import { DR2_GROUPS, DR2_ROOT } from "@/lib/arkh/stats/defs/drop-rate-v2";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: vals.reduce((a, b) => a + b, 0),
  product: 0,
});
const key = (k: string) => {
  const g = DR2_GROUPS.find((x) => x.key === k);
  if (!g) throw new Error(`no group ${k}`);
  return g.key;
};
const empty = (): Record<string, Pool> => Object.fromEntries(DR2_GROUPS.map((g) => [g.key, pool()]));
const total = (over: Record<string, Pool>) => combineDropRateV2Pools({ ...empty(), ...over }).total;

describe("Drop Rate V2 groups (N.js Drop_Rarity)", () => {
  it("runs base → chip → bun_v → Workbench → OLA[232] → bun_p → factors → Cove", () => {
    expect(DR2_GROUPS.slice(0, 6).map((g) => [g.key, g.kind])).toEqual([
      ["base", "pct"],
      ["chip", "add"],
      ["bunV", "add"],
      ["workbench", "mult"],
      ["ola232", "add"],
      ["bunP", "mult"],
    ]);
    expect(DR2_GROUPS.find((g) => g.key === "chip")!.below).toBe(5);
    expect(DR2_GROUPS[DR2_GROUPS.length - 1]).toMatchObject({ key: "cove", kind: "replace", sources: ["cove"] });
  });

  it("has unique group keys and source ids", () => {
    const keys = DR2_GROUPS.map((g) => g.key);
    const ids = DR2_GROUPS.flatMap((g) => g.sources);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts the LUK curve, Σ and DropRateLUK2 in the base group in game order", () => {
    const base = DR2_GROUPS[0].sources;
    expect(base[0]).toBe("luk");
    // DropRateLUK2 sits between TomeBonus(2) and Grid_Bonus(173); Companions(132) closes Σ.
    expect(base.slice(base.indexOf("tome2"), base.indexOf("tome2") + 2)).toEqual(["tome2", "mini5a"]);
    expect(base.slice(-3)).toEqual(["talent239", "grid173", "comp132"]);
    expect(base).toContain("etc102");
    expect(base.length).toBe(1 + 23 + 27 + 2);
  });

  it("an empty pool set is 1", () => {
    const r = combineDropRateV2Pools(empty());
    expect(r.total).toBe(1);
    expect(r.tree.name).toBe(DR2_ROOT);
    expect(r.tree.children).toHaveLength(DR2_GROUPS.length);
  });

  it("the base is 1 + Σ/100, the LUK source carrying 140 × curve", () => {
    // 1.4 · 0.5 (curve) + 30/100 → 2
    expect(total({ [key("base")]: pool(140 * 0.5, 30) })).toBeCloseTo(2, 12);
  });

  it("the chip only tops a total under 5 up to 5", () => {
    expect(total({ base: pool(100), chip: pool(1.5) })).toBeCloseTo(3.5, 12);
    expect(total({ base: pool(100), chip: pool(4) })).toBe(5);
    expect(total({ base: pool(500), chip: pool(4) })).toBe(6);
  });

  it("applies +2, the Workbench, +0.3 and ×1.2 in game order", () => {
    // ((2 + 2) × 1.5 + 0.3) × 1.2
    const r = total({ base: pool(100), bunV: pool(2), workbench: pool(1.5), ola232: pool(0.3), bunP: pool(1.2) });
    expect(r).toBeCloseTo(((2 + 2) * 1.5 + 0.3) * 1.2, 12);
  });

  it("multiplies the step-5 factors by their shapes", () => {
    expect(total({ arcane: pool(50) })).toBeCloseTo(1.5, 12);
    expect(total({ rog: pool(10, 5) })).toBeCloseTo(1.15, 12);
    expect(total({ comp168: pool(1.45) })).toBeCloseTo(1.45, 12);
  });

  it("a max1 factor floors at 1", () => {
    expect(total({ glimbo: pool(0) })).toBe(1);
    expect(total({ comp26x160: pool(0.5, 1) })).toBe(1);
    expect(total({ comp26x160: pool(1.3, 1.5) })).toBeCloseTo(1.95, 12);
  });

  it("the Cove replaces the whole total, and 0 leaves it alone", () => {
    const p = { base: pool(300), bunP: pool(1.2) };
    expect(total({ ...p, cove: pool(0) })).toBeCloseTo(4.8, 12);
    expect(total({ ...p, cove: pool(123.5) })).toBe(123.5);
  });
});
