import { describe, it, expect } from "vitest";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import { multikillGainsModel } from "@/lib/multikill/gains";
import { formatMultikill } from "@/lib/multikill/format";
import { MK_NODES, MK_ROOT, mkHalves, mkRuleRows, mkTotal, type MkParts } from "@/lib/multikill/layers";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import type { ArkhNode } from "@/lib/dropRate/node";

describe("Multikill page config", () => {
  it("uses its own storage keys, the % unit and the game's format", () => {
    expect(MULTIKILL_PAGE.storage).toEqual({
      save: "multikill-tracker.last-upload.v1",
      name: "multikill-tracker.playerName",
      snapshots: "multikill-tracker.v1",
      collapse: "multikill.snapshot-section.collapsed.v1",
      exportPrefix: "multikill-snapshots",
      exportLabel: "multikill-tracker",
    });
    expect(MULTIKILL_PAGE).toMatchObject({
      statName: "Multikill",
      gainLabel: "Multikill",
      emoji: "💥",
      calculatorTitle: "Multikill Calculator",
      totalLabel: "Total Multikill",
      unit: "%",
      errPrefix: "Multikill compute failed",
      mapTitle: "The map sets the Death Note page, the W7 soft cap and ×5 tier ladder, the target's HP and the Crystal Glunko Cove",
    });
    expect(MULTIKILL_PAGE.formatTotal).toBe(formatMultikill);
    expect(MULTIKILL_PAGE.gains).toBe(multikillGainsModel);
    expect(MULTIKILL_PAGE.totalTitle!(81706)).toBe("81,706%");
  });

  it("loads the Observed Max for a class", async () => {
    const top = await MULTIKILL_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });

  it("loadTop drops the tier's and status's diagnostic children, keeps the values themselves", async () => {
    const top = await MULTIKILL_PAGE.loadTop();
    const flat = top.flatForClass(null);
    expect(flat[`${MK_ROOT} / ${MK_NODES.tier}`]).toBe(51);
    expect(flat[`${MK_ROOT} / ${MK_NODES.active}`]).toBe(1);
    for (const path of Object.keys(flat)) {
      expect(path.startsWith(`${MK_ROOT} / ${MK_NODES.tier} / `)).toBe(false);
      expect(path.startsWith(`${MK_ROOT} / ${MK_NODES.active} / `)).toBe(false);
    }
  });
});

describe("Multikill what-if gains model (synthetic)", () => {
  const n = (name: string, val: number, children?: ArkhNode[]): ArkhNode => ({ name, val, ...(children ? { children } : {}) });
  type Opt = { base?: number; perTier?: number; tier?: number; w7?: boolean; cove?: [number, number] };
  // the page's tree: the base half, the tier, the per-tier half (each half with its rule row), the status (lib/game/trackers/multikill.ts)
  const flatOf = (o: Opt = {}) => {
    const base = [n("Base A", 600), n("Base B", (o.base ?? 1063.45) - 600)];
    const perTier = [n("Death Note (W1 page)", 300), n("Per tier X", (o.perTier ?? 1581.2331135382508) - 300)];
    const tier = n(o.w7 ? MK_NODES.tierW7 : MK_NODES.tier, o.tier ?? 51, [n("Exponent", o.w7 ? 5 : 2), n("Next tier at", 1.5e31)]);
    const sum = (xs: ArkhNode[]) => xs.reduce((a, it) => a + it.val, 0);
    const p: MkParts = { base: sum(base), perTier: sum(perTier), tier: tier.val, softCap: !!o.w7, cove: o.cove ? { base: o.cove[0], perTier: o.cove[1] } : null };
    const h = mkHalves(p);
    return flattenTree({
      name: MK_ROOT,
      val: mkTotal(p),
      fmt: "%",
      children: [
        { name: MK_NODES.base, val: h.base, fmt: "+", children: [...base, ...mkRuleRows(p, p.base, h.base)] },
        tier,
        { name: MK_NODES.perTier, val: h.perTier, fmt: "+", children: [...perTier, ...mkRuleRows(p, p.perTier, h.perTier)] },
        n(MK_NODES.active, 1),
      ],
    });
  };
  const W7: Opt = { perTier: 1741.2331135382508, tier: 24, w7: true };
  const A = `${MK_ROOT} / ${MK_NODES.base} / Base A`;
  const X = `${MK_ROOT} / ${MK_NODES.perTier} / Per tier X`;
  const DN = (w: number) => `${MK_ROOT} / ${MK_NODES.perTier} / Death Note (W${w} page)`;
  const TIER = `${MK_ROOT} / ${MK_NODES.tier}`;

  it.each<[string, Opt, number]>([
    ["map 14", {}, 81706],
    ["the W7 soft cap", W7, 3185],
    ["the Cove", { cove: [3800, 46] }, 6146],
  ])("totalFromFlat = the tree (%s): one mkTotal for both (spec M14)", (_n, o, want) => {
    const flat = flatOf(o);
    expect(flat[MK_ROOT]).toBe(want);
    expect(multikillGainsModel.totalFromFlat(flat)).toBe(want);
  });

  it("a base source is worth ×1 and a per-tier source ×T", () => {
    const flat = flatOf();
    const { rows } = computeGains(multikillGainsModel, flat, { [A]: 700, [X]: flat[X] + 100 });
    const gain = (s: string) => rows.find((r) => r.source === s)!.gainPct;
    expect(gain("Base A")).toBeCloseTo((81806 / 81706 - 1) * 100, 9);
    expect(gain("Per tier X")).toBeCloseTo((86806 / 81706 - 1) * 100, 9); // +6.24%
  });

  it("in W7 the soft cap flattens a per-tier source: +100 is +1.5%", () => {
    const flat = flatOf(W7);
    const { rows } = computeGains(multikillGainsModel, flat, { [X]: flat[X] + 100 });
    expect(rows.find((r) => r.source === "Per tier X")!.gainPct).toBeCloseTo((3233 / 3185 - 1) * 100, 9);
  });

  it("in the Cove the sources don't move the total, so only the tier is offered", () => {
    expect(computeGains(multikillGainsModel, flatOf({ cove: [3800, 46] }), { [A]: 5000 }).rows).toEqual([]);
    expect(multikillGainsModel.sources(flatOf({ cove: [3800, 46] }), {}).map((s) => s.source)).toEqual([MK_NODES.tier]);
  });

  it("the tier ranks against the reference below map 300, never in W7 (spec M12)", () => {
    const below = computeGains(multikillGainsModel, flatOf({ tier: 40 }), { [TIER]: 51 });
    const tierRow = below.rows.find((r) => r.source === MK_NODES.tier);
    expect(tierRow).toMatchObject({ you: 40, max: 51, display: "raw" });
    expect(tierRow!.group).toBe(MK_NODES.tier); // max damage = the game's: no "estimate" tag
    const w7 = computeGains(multikillGainsModel, flatOf(W7), { [TIER]: 51 });
    expect(w7.comparableSources).toBe(0);
    expect(w7.rows.map((r) => r.source)).toEqual(["+1 damage tier"]);
  });

  it("'+1 damage tier' is a lever: the next tier's gain and the ×E text; gone at 51 (spec M13)", () => {
    const [lever] = multikillGainsModel.levers!(flatOf(W7));
    expect(lever).toMatchObject({ source: "+1 damage tier", you: 24, max: 25, display: "raw" });
    expect(lever.gainPct).toBeCloseTo((3313 / 3185 - 1) * 100, 9); // +4.0%
    expect(lever.group).toBe("needs ×5 more max damage (next tier at 1.500E31)");
    expect(multikillGainsModel.levers!(flatOf())).toEqual([]);
  });

  it("the lever asks for next ÷ max damage; a target without HP offers neither the tier nor the lever", () => {
    const tp = `${MK_ROOT} / ${MK_NODES.tierW7}`;
    const [lever] = multikillGainsModel.levers!({ ...flatOf(W7), [`${tp} / Max Damage`]: 1e31 });
    expect(lever.group).toBe("needs ×1.5 more max damage (next tier at 1.500E31)");
    const noHp = { ...flatOf({ tier: 1 }), [`${TIER} / Next tier at`]: 0 };
    expect(multikillGainsModel.levers!(noHp)).toEqual([]);
    expect(multikillGainsModel.sources(noHp, {}).some((s) => s.path === TIER)).toBe(false);
  });

  it("the Death Note row only meets a reference on the same world (spec M11)", () => {
    const flat = flatOf();
    expect(computeGains(multikillGainsModel, flat, { [DN(6)]: 280 }).comparableSources).toBe(0);
    expect(computeGains(multikillGainsModel, flat, { [DN(1)]: 300 }).comparableSources).toBe(1);
  });
});
