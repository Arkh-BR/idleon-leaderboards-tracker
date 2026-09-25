import { describe, it, expect } from "vitest";
import { mkSoftCap, mkTotal, MK_NODES, MK_ROOT, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { combineMultikillPools } from "@/lib/arkh/computeMultikill";
import type { ArkhNode } from "@/lib/arkh/node";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const n = (name: string, val: number, children?: ArkhNode[]): ArkhNode => ({ name, val, ...(children ? { children } : {}) });
const pool = (...items: ArkhNode[]): Pool => ({ items, sum: 0, product: 0 });
const pools = (o: { base?: number[]; perTier?: number[]; tier?: number; soft?: boolean; cove?: [number, number] } = {}) => ({
  base: pool(...(o.base ?? [1063.45]).map((v, i) => n(`b${i}`, v))),
  perTier: pool(...(o.perTier ?? [1581.2331135382508]).map((v, i) => n(`p${i}`, v))),
  tier: pool(n(MK_NODES.tier, o.tier ?? 51)),
  rules: pool(
    n(MK_RULES.softCap, o.soft ? 1 : 0),
    n(MK_RULES.cove, o.cove ? 1 : 0, [n("base", o.cove?.[0] ?? 0), n("perTier", o.cove?.[1] ?? 0)])
  ),
  status: pool(n(MK_NODES.active, 1)),
});

describe("mkSoftCap (Shimmerfin Deep)", () => {
  it.each<[number, number]>([
    [0, 0], [19.5, 19.5], [20, 20], [50, 47.3], [100, 80.6], [150, 90.6], [200, 95.6], [250, 98.14], [300, 99.14], [1063.45, 114.409],
  ])("%s → %s", (v, out) => expect(mkSoftCap(v)).toBeCloseTo(out, 9));

  it("the steps at 50, 100 and 250 are under 0.05", () => {
    for (const e of [50, 100, 250]) expect(Math.abs(mkSoftCap(e) - mkSoftCap(e - 1e-9))).toBeLessThan(0.05);
  });
});

describe("mkTotal", () => {
  it("floors B + T × P", () =>
    expect(mkTotal({ base: 1063.45, perTier: 1581.2331135382508, tier: 51, softCap: false, cove: null })).toBe(81706));
  it("the soft cap applies to both halves", () =>
    expect(mkTotal({ base: 1063.45, perTier: 1741.2331135382508, tier: 24, softCap: true, cove: null })).toBe(3185));
  it("the Cove replaces both sums", () =>
    expect(mkTotal({ base: 99999, perTier: 99999, tier: 51, softCap: false, cove: { base: 3800, perTier: 46 } })).toBe(6146));
});

describe("Multikill combine", () => {
  it("builds ⌊B′ + T × P′⌋ with four children and the root in %", () => {
    const { tree, total } = combineMultikillPools(pools({ base: [600, 463.45] }));
    expect(total).toBe(81706);
    expect(tree).toMatchObject({ name: MK_ROOT, fmt: "%", note: "⌊B′ + T × P′⌋" });
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0]).toMatchObject({ fmt: "+", note: "B′" });
    expect(tree.children![0].val).toBeCloseTo(1063.45, 9);
    expect(tree.children![0].children).toHaveLength(2); // no rule row off W7 and the Cove
  });

  it("appends a soft-cap row to each half on a W7 map", () => {
    const { tree, total } = combineMultikillPools(pools({ perTier: [1741.2331135382508], tier: 24, soft: true }));
    expect(total).toBe(3185);
    const [b, , p] = tree.children!;
    expect(b.val).toBeCloseTo(114.409, 9);
    expect(b.children!.at(-1)).toMatchObject({ name: MK_RULES.softCap });
    expect(p.children!.at(-1)!.note).toMatch(/reduced by ~93%$/);
  });

  it("a W7 sum below 20 isn't capped, and its note says so (even at 0)", () => {
    const { tree } = combineMultikillPools(pools({ base: [0], perTier: [0.5], tier: 1, soft: true }));
    const [b, , p] = tree.children!;
    expect(b.children!.at(-1)!.note).toMatch(/reduced by ~0%$/);
    expect(p.children!.at(-1)!.note).toMatch(/reduced by ~0%$/);
  });

  it("the Cove row replaces each half's value", () => {
    const { tree, total } = combineMultikillPools(pools({ cove: [3800, 46] }));
    expect(total).toBe(6146);
    expect(tree.children![0]).toMatchObject({ val: 3800 });
    expect(tree.children![0].children!.at(-1)).toMatchObject({ name: MK_RULES.cove, val: 3800 });
    expect(tree.children![2].children!.at(-1)).toMatchObject({ name: MK_RULES.cove, val: 46 });
  });
});
