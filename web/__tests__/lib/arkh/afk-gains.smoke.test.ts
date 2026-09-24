// CI smoke test — no private save. Every AFK source must resolve on an empty
// envelope (the afk switch throws on unknown ids), and the map rules must work
// on synthetic saves. Synthetic OLA arrays are sparse on purpose: a 0 at
// OLA[606] would switch companion 0 on (Pet-Bonus Token CSV).
import { describe, it, expect } from "vitest";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { AFK_POOLS } from "@/lib/arkh/stats/defs/afk-gains";
import { FORMULA_REGISTRY } from "@/scripts/updater/registry/formula-registry.gen";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// StarSg: {} is explicit because the arkh singleton only assigns
// starSignsUnlocked when StarSg is present in the envelope (see
// global-constraints.md); leaving it out would let starFightAFK read
// whatever an earlier-loaded save left behind.
const EMPTY = { charNames: ["A"], data: { StarSg: {} } };

describe("AFK Gains smoke test", () => {
  it("resolves every source on an empty save; map 1 is the bare 40% base", () => {
    const { tree, total } = computeArkhAfkGains(EMPTY, 0, 1);
    expect(total).toBe(0.4);
    expect(tree.children).toHaveLength(6);
    const [fight, all] = AFK_POOLS;
    expect(tree.children![0].children).toHaveLength(fight.sources.length + all.sources.length);
    expect(tree.children![1].children).toHaveLength(1);
    expect(tree.children![2].children).toHaveLength(1);
  });

  it("a town (map 0, target Nothing) and a map without a target definition (3, JungleZ) are 0", () => {
    expect(computeArkhAfkGains(EMPTY, 0, 0).total).toBe(0);
    expect(computeArkhAfkGains(EMPTY, 0, 3).total).toBe(0);
  });

  it("a skill map (6, Copper = MINING) keeps the fighting rate, with a note", () => {
    const t = computeArkhAfkGains(EMPTY, 0, 6).tree;
    expect(t.val).toBe(0.4);
    expect(t.children![5].note).toMatch(/MINING/);
  });

  it("Clamworks (map 306) is ×0.2", () => {
    expect(computeArkhAfkGains(EMPTY, 0, 306).total).toBeCloseTo(0.08, 12);
  });

  it("the Crystal Glunko Cove (map 216, cavern 17) replaces the rate; ×1.3 with bun_u", () => {
    const ola: number[] = [];
    ola[638] = 58;
    ola[643] = 33;
    const cove = (cavern: number, bundles: Record<string, number>) => ({
      charNames: ["A"],
      data: { StarSg: {}, Holes: [[cavern]], OptLacc: ola, BundlesReceived: bundles },
    });
    // (10 + OLA[638]·RandoListo2[13][8] + OLA[643]·RandoListo2[13][13])/100 = (10 + 58·1 + 33·3)/100
    expect(computeArkhAfkGains(cove(17, { bun_u: 1 }), 0, 216).total).toBeCloseTo(1.67 * 1.3, 12);
    expect(computeArkhAfkGains(cove(17, {}), 0, 216).total).toBeCloseTo(1.67, 12);
    // Another cavern: MapAFKtarget[216] is "Nothing" → 0 (spec A9).
    expect(computeArkhAfkGains(cove(3, { bun_u: 1 }), 0, 216).total).toBe(0);
  });

  it("registers the port under N.js's AFKgainrates for the updater", () => {
    expect(FORMULA_REGISTRY["_customBlock_AFKgainrates"]).toEqual(["lib/arkh/stats/systems/afk/afk.ts"]);
  });
});
