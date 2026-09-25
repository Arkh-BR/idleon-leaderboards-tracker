import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import { multikillGainsModel } from "@/lib/multikill/gains";
import { formatMultikill } from "@/lib/multikill/format";
import { MK_NODES, MK_ROOT, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { combineMultikillPools, computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import type { ArkhNode } from "@/lib/arkh/node";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

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
  const pool = (...items: ArkhNode[]): Pool => ({ items, sum: 0, product: 0 });
  type Opt = { base?: number; perTier?: number; tier?: number; w7?: boolean; cove?: [number, number] };
  const flatOf = (o: Opt = {}) =>
    flattenTree(
      combineMultikillPools({
        base: pool(n("Base A", 600), n("Base B", (o.base ?? 1063.45) - 600)),
        perTier: pool(n("Death Note (W1 page)", 300), n("Per tier X", (o.perTier ?? 1581.2331135382508) - 300)),
        tier: pool(n(o.w7 ? MK_NODES.tierW7 : MK_NODES.tier, o.tier ?? 51, [n("Exponent", o.w7 ? 5 : 2), n("Next tier at", 1.5e31)])),
        rules: pool(
          n(MK_RULES.softCap, o.w7 ? 1 : 0),
          n(MK_RULES.cove, o.cove ? 1 : 0, [n("base", o.cove?.[0] ?? 0), n("perTier", o.cove?.[1] ?? 0)])
        ),
        status: pool(n(MK_NODES.active, 1)),
      }).tree
    );
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
    expect(tierRow!.group).toContain("estimate"); // spec M17: below 51 is an estimate
    const w7 = computeGains(multikillGainsModel, flatOf(W7), { [TIER]: 51 });
    expect(w7.comparableSources).toBe(0);
    expect(w7.rows.map((r) => r.source)).toEqual(["+1 damage tier"]);
  });

  it("'+1 damage tier' is a lever: the next tier's gain and the ×E text; gone at 51 (spec M13)", () => {
    const [lever] = multikillGainsModel.levers!(flatOf(W7));
    expect(lever).toMatchObject({ source: "+1 damage tier", you: 24, max: 25, display: "raw" });
    expect(lever.gainPct).toBeCloseTo((3313 / 3185 - 1) * 100, 9); // +4.0%
    expect(lever.group).toBe("needs ×5 more max damage (next tier at 1.500E31) · estimate");
    expect(multikillGainsModel.levers!(flatOf())).toEqual([]);
  });

  it("the Death Note row only meets a reference on the same world (spec M11)", () => {
    const flat = flatOf();
    expect(computeGains(multikillGainsModel, flat, { [DN(6)]: 280 }).comparableSources).toBe(0);
    expect(computeGains(multikillGainsModel, flat, { [DN(1)]: 300 }).comparableSources).toBe(1);
  });
});

describe.skipIf(!existsSync(SAVE))("Multikill what-if on the ARKHE save", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const markhe = () => save.charNames.indexOf("Markhe");

  it.each<[number, number]>([
    [14, 81706],
    [301, 3185],
    [306, 626],
    [251, 80686],
  ])("Markhe on map %i: totalFromFlat = the tree = %i", (map, want) => {
    const t = computeArkhMultikill(save, markhe(), map).tree;
    expect(t.val).toBe(want);
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(want);
  });

  it("the Cove copy (ARKHE in cavern 17): totalFromFlat = 6146", () => {
    const copy = JSON.parse(JSON.stringify(save));
    const holes = typeof copy.data.Holes === "string" ? JSON.parse(copy.data.Holes) : copy.data.Holes;
    holes[0][0] = 17;
    copy.data.Holes = typeof copy.data.Holes === "string" ? JSON.stringify(holes) : holes;
    const t = computeArkhMultikill(copy, 0, 216).tree;
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(6146);
  });

  it("Markhe on map 301: +1 damage tier, 24 → 25, is +4.0%", () => {
    const [lever] = multikillGainsModel.levers!(flattenTree(computeArkhMultikill(save, markhe(), 301).tree));
    expect(lever).toMatchObject({ you: 24, max: 25 });
    expect(lever.gainPct).toBeCloseTo((3313 / 3185 - 1) * 100, 9);
    expect(lever.group).toMatch(/^needs ×5 more max damage \(next tier at /);
  });
});
