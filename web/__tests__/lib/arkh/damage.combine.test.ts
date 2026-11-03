import { describe, it, expect } from "vitest";
import damageDesc, {
  DMG_GROUPS,
  DMG_LAYERS,
  DMG_NODES,
  DMG_RAT,
  DMG_ROOT,
  DMG_RULES,
  capBase,
  capMult,
  capPct,
  dmgLayer,
  dmgMastery,
  dmgMax,
} from "@/lib/arkh/stats/defs/damage";
import { combineStatPools } from "@/lib/arkh/computeStat";
import type { ArkhNode } from "@/lib/arkh/node";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const n = (name: string, val: number): ArkhNode => ({ name, val });
/** Every pool of the descriptor, empty except the ones given (key → source values). */
const pools = (o: Record<string, number[]> = {}): Record<string, Pool> => {
  for (const k of Object.keys(o)) if (!(k in damageDesc.pools)) throw new Error(`no pool ${k}`);
  return Object.fromEntries(
    Object.keys(damageDesc.pools).map((k) => [k, { items: (o[k] ?? []).map((v, i) => n(`${k}${i}`, v)), sum: 0, product: 0 }]),
  );
};
const valsOfPools = (o: Record<string, number[]>) => (k: string) => o[k] ?? [];
const walk = (t: ArkhNode): ArkhNode[] => [t, ...(t.children ?? []).flatMap(walk)];
const byName = (t: ArkhNode, name: string) => t.children!.find((c) => c.name === name)!;

describe("soft caps (N.js DamageDealed)", () => {
  it("capBase: untouched up to 4000, then x^0.91", () => {
    expect(capBase(3000)).toBe(3000);
    expect(capBase(4000)).toBe(4000);
    expect(capBase(5000)).toBeCloseTo(4000 + 1000 ** 0.91, 9);
    expect(capBase(20000)).toBeCloseTo(4000 + 16000 ** 0.91, 9); // 10.7k: still under the 15000 bracket
  });

  it("capBase: the 15000 bracket applies on the already capped value", () => {
    const a = 4000 + (1e5 - 4000) ** 0.91;
    expect(a).toBeGreaterThan(15000);
    expect(capBase(1e5)).toBeCloseTo(15000 + (a - 15000) ** 0.84, 9);
  });

  it("capPct: 100 bracket, then 2e6 and 1e8 chained", () => {
    expect(capPct(50)).toBe(50);
    expect(capPct(3e8)).toBeCloseTo(2e6 * ((100 + (3e8 - 100) ** 0.86) / 2e6) ** 0.5, 3); // 2 of 3 brackets
    const a = 100 + (1e12 - 100) ** 0.86;
    const b = 2e6 * (a / 2e6) ** 0.5;
    expect(a).toBeGreaterThan(2e6);
    expect(b).toBeGreaterThan(1e8);
    expect(capPct(1e12)).toBeCloseTo(1e8 * (b / 1e8) ** 0.3, 3);
  });

  it("capMult: 100 bracket, then the five N.js brackets chained in order", () => {
    expect(capMult(50)).toBe(50);
    expect(capMult(100)).toBe(100);
    let v = 100 + (1e27 - 100) ** 0.86;
    for (const [t, e] of [[2e7, 0.8], [5e8, 0.6], [2e9, 0.45], [15e9, 0.36], [6e10, 0.28]] as const) {
      expect(v).toBeGreaterThan(t); // every bracket is crossed
      v = t * (v / t) ** e;
    }
    expect(capMult(1e27) / v).toBeCloseTo(1, 12);
  });
});

describe("dmgLayer", () => {
  const [base, pct, mult] = DMG_LAYERS;

  it("runs the steps in order, the cap before the food term", () => {
    const r = dmgLayer(base, valsOfPools({ l0: [5000], l0food: [100] }));
    expect(r.capIn).toBe(5000);
    expect(r.capOut).toBeCloseTo(capBase(5000), 9);
    expect(r.val).toBeCloseTo(capBase(5000) + 100, 9);
  });

  it("starts at 1 for the percent layers and applies pct/mult groups as factors", () => {
    expect(dmgLayer(pct, valsOfPools({})).val).toBe(1);
    expect(dmgLayer(pct, valsOfPools({ l1base: [50], l1gold: [2] })).val).toBe(3);
    expect(dmgLayer(mult, valsOfPools({ l2buff: [100], l2a: [3] })).val).toBe(6);
  });

  it("reliquarium raises L2 to the exponent; 0 is the neutral step", () => {
    expect(dmgLayer(mult, valsOfPools({ l2post: [400], l2relic: [0.5] })).val).toBeCloseTo(20, 9);
    expect(dmgLayer(mult, valsOfPools({ l2post: [400], l2relic: [0] })).val).toBe(400);
    expect(dmgLayer(mult, valsOfPools({ l2post: [400] })).val).toBe(400);
  });
});

describe("dmgMax / dmgMastery", () => {
  it("L0 · L1 · L2", () => {
    const v = valsOfPools({ l0: [5000], l1base: [50], l2a: [2] });
    expect(dmgMax(v)).toBeCloseTo(capBase(5000) * 1.5 * 2, 9);
  });

  it("empty everything: Max 0, mastery floor 0.35", () => {
    expect(dmgMax(valsOfPools({}))).toBe(0);
    expect(dmgMastery(valsOfPools({}))).toBeCloseTo(0.35, 12);
  });

  it("the Royal Guardian arena replaces the total and mastery drops to 0.2", () => {
    const v = valsOfPools({ l0: [5000], l1base: [50], rat: [123], mastery: [10] });
    expect(dmgMax(v)).toBe(123);
    expect(dmgMastery(v)).toBe(0.2);
  });

  it("rat = 0 doesn't replace", () => {
    const v = valsOfPools({ l0: [5000], rat: [0], mastery: [10] });
    expect(dmgMax(v)).toBeCloseTo(capBase(5000), 9);
    expect(dmgMastery(v)).toBeCloseTo(0.45, 12);
  });

  it("mastery = min(0.8, 0.35 + Σ/100), talent 113 comes in negative", () => {
    expect(dmgMastery(valsOfPools({ mastery: [10, 5] }))).toBeCloseTo(0.5, 12);
    expect(dmgMastery(valsOfPools({ mastery: [100] }))).toBe(0.8);
    expect(dmgMastery(valsOfPools({ mastery: [-10, 5] }))).toBeCloseTo(0.3, 12);
  });
});

describe("Damage combine", () => {
  it("empty pools: finite root, no NaN anywhere, Max 0", () => {
    const { tree, total } = combineStatPools(damageDesc, pools());
    expect(total).toBe(0);
    for (const x of walk(tree)) expect(Number.isFinite(x.val), x.name).toBe(true);
  });

  it("root is Max in raw, with the Min ~ Max note", () => {
    const { tree, total } = combineStatPools(damageDesc, pools({ l0: [5000], l1base: [50], l2a: [2] }));
    expect(total).toBeCloseTo(capBase(5000) * 1.5 * 2, 9);
    expect(tree).toMatchObject({ name: DMG_ROOT, fmt: "raw", note: "Min ~ Max · Min = Max × Mastery" });
    expect(tree.val).toBe(total);
  });

  it("root children: the three layers, the arena, then mastery", () => {
    const { tree } = combineStatPools(damageDesc, pools());
    expect(tree.children!.map((c) => c.name)).toEqual([
      DMG_NODES.base, DMG_NODES.pct, DMG_NODES.mult, DMG_RULES.rat, DMG_NODES.mastery,
    ]);
  });

  it("each layer lists its steps in game order, the cap as a row between them", () => {
    const { tree } = combineStatPools(damageDesc, pools());
    const names = (layer: string) => byName(tree, layer).children!.map((c) => c.name);
    expect(names(DMG_NODES.base)).toEqual(["Base Damage sources", DMG_RULES.capBase, "Food (after soft cap)"]);
    const mult = names(DMG_NODES.mult);
    expect(mult.indexOf(DMG_RULES.capMult)).toBe(mult.indexOf("Late multipliers") + 1);
    expect(mult.at(-2)).toBe(DMG_RULES.relic);
    expect(names(DMG_NODES.pct)).toContain(DMG_RULES.capPct);
    // one child per step, and the layer node carries the layer's value
    DMG_LAYERS.forEach((l) => expect(names(l.node)).toHaveLength(l.steps.length));
  });

  it("cap row: capOut/capIn as a multiplier, note 'in → out'", () => {
    const { tree } = combineStatPools(damageDesc, pools({ l0: [5000] }));
    const cap = byName(byName(tree, DMG_NODES.base), DMG_RULES.capBase);
    expect(cap.fmt).toBe("x");
    expect(cap.val).toBeCloseTo(capBase(5000) / 5000, 12);
    expect(cap.note).toMatch(/^5000 → \d/);
    expect(byName(byName(tree, DMG_NODES.base), "Base Damage sources").children).toHaveLength(1);
  });

  it("layer node value = the layer's value; arena node is 0 off map 43 and the replacement on it", () => {
    const off = combineStatPools(damageDesc, pools({ l0: [5000], l1base: [50] })).tree;
    expect(byName(off, DMG_NODES.pct).val).toBe(1.5);
    expect(byName(off, DMG_RULES.rat).val).toBe(0);
    const on = combineStatPools(damageDesc, pools({ l0: [5000], rat: [123] })).tree;
    expect(on.val).toBe(123);
    expect(byName(on, DMG_RULES.rat)).toMatchObject({ val: 123, fmt: "raw" });
  });

  it("reliquarium node shows the exponent and its item", () => {
    const { tree } = combineStatPools(damageDesc, pools({ l2relic: [0.5] }));
    const relic = byName(byName(tree, DMG_NODES.mult), DMG_RULES.relic);
    expect(relic.val).toBe(0.5);
    expect(relic.children).toHaveLength(1);
  });

  it("mastery node: value and its sources", () => {
    const { tree } = combineStatPools(damageDesc, pools({ mastery: [10, 5] }));
    const m = byName(tree, DMG_NODES.mastery);
    expect(m.val).toBeCloseTo(0.5, 12);
    expect(m.children).toHaveLength(2);
  });
});

describe("descriptor shape", () => {
  it("identity", () => {
    expect(damageDesc).toMatchObject({ id: "damage", name: DMG_ROOT, scope: "character+map", category: "progression" });
  });

  it("one pool per source-bearing step, all pointing at the `damage` system", () => {
    const withSources = [...DMG_GROUPS.map((g) => g.key), "l2relic"];
    expect(Object.keys(damageDesc.pools).sort()).toEqual(withSources.sort());
    for (const specs of Object.values(damageDesc.pools)) for (const s of specs) expect(s.system).toBe("damage");
    expect(damageDesc.pools.rat.map((s) => s.id)).toEqual(["ratDmg"]);
    expect(DMG_RAT).toMatchObject({ key: "rat", kind: "replace" });
  });

  it("DMG_GROUPS has every layer group, mastery and rat — but not the cap/pow steps", () => {
    const keys = DMG_GROUPS.map((g) => g.key);
    expect(keys).toContain("mastery");
    expect(keys).toContain("rat");
    expect(keys).not.toContain("capBase");
    expect(keys).not.toContain("l2relic");
    expect(new Set(keys).size).toBe(keys.length);
  });
});
