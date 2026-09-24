import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AFK_PAGE, afkGainsModel, formatAfkGains } from "@/lib/afkGains/pageConfig";
import { AFK_NODES, AFK_ROOT } from "@/lib/arkh/stats/defs/afk-gains";
import { combineAfkPools, computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";
const SAVE_0924 = "scripts/updater/golden/.cache/arkhe-live-2026-09-24.json";

describe("AFK Gains page config", () => {
  it("uses its own storage keys and the % unit", () => {
    expect(AFK_PAGE.storage).toEqual({
      save: "afk-gains-tracker.last-upload.v1",
      name: "afk-gains-tracker.playerName",
      snapshots: "afk-gains-tracker.v1",
      collapse: "afk-gains.snapshot-section.collapsed.v1",
      exportPrefix: "afk-gains-snapshots",
      exportLabel: "afk-gains-tracker",
    });
    expect(AFK_PAGE).toMatchObject({
      statName: "AFK Gains Rate",
      gainLabel: "AFK",
      emoji: "💤",
      calculatorTitle: "AFK Gains Calculator",
      totalLabel: "AFK Gains Rate (Fighting)",
      unit: "%",
      errPrefix: "AFK gains compute failed",
    });
    expect(AFK_PAGE.formatTotal).toBe(formatAfkGains);
  });

  // N.js @3790178: ""+Math.floor(100*rate)+"%" (the kit adds the "%").
  it.each<[number, string]>([
    [422.31870591798446, "42231"],
    [549.6821378607555, "54968"],
    [84.46374118359688, "8446"],
    [0.4, "40"],
    [0.01, "1"],
    [0, "0"],
    // 100 × 0.29 is 28.999999999999996 in floats; the game's JS prints 28 too.
    [0.29, "28"],
  ])("formatAfkGains(%s) → %s", (v, s) => expect(formatAfkGains(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatAfkGains(NaN)).toBe("—"));

  it("loads the Observed Max for a class", async () => {
    const top = await AFK_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });
});

describe("AFK what-if gains model (synthetic)", () => {
  const P = (...items: Array<[string, number]>): Pool => ({ items: items.map(([name, val]) => ({ name, val })), sum: 0, product: 0 });
  const flatOf = (clam: number, cove: number, type: number) =>
    flattenTree(
      combineAfkPools({
        fight: P(["Base fighting rate (40%)", 40], ["A", 100]),
        all: P(["B", 60]),
        multi: P(["Arcane", 0], ["Etc 92", 0]),
        rules: P([AFK_NODES.clam, clam], [AFK_NODES.cove, cove], [AFK_NODES.type, type]),
      }).tree
    );
  const A = `${AFK_ROOT} / ${AFK_NODES.pool} / A`;

  it("ranks a pool source by the rate it would add", () => {
    const { rows } = computeGains(afkGainsModel, flatOf(1, 0, 1), { [A]: 300 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", group: AFK_NODES.pool, display: "pct", you: 100, max: 300 });
    expect(rows[0].gainPct).toBeCloseTo(100, 9); // Σ 200 → 400
  });

  it("no row while the Cove replaces the rate", () => {
    expect(computeGains(afkGainsModel, flatOf(1, 2.171, 1), { [A]: 300 }).rows).toEqual([]);
  });

  it("nothing is comparable when the target isn't a fight", () => {
    const r = computeGains(afkGainsModel, flatOf(1, 0, 0), { [A]: 300 });
    expect(r.rows).toEqual([]);
    expect(r.comparableSources).toBe(0);
  });

  it("totalFromFlat mirrors the tree", () => {
    for (const [clam, cove, type] of [[1, 0, 1], [0.2, 0, 1], [1, 2.171, 1], [1, 0, 0]]) {
      const flat = flatOf(clam, cove, type);
      expect(afkGainsModel.totalFromFlat(flat)).toBeCloseTo(flat[AFK_ROOT], 12);
    }
  });
});

describe.skipIf(!existsSync(SAVE))("AFK what-if gains on the ARKHE save (Markhe)", () => {
  let save: any;
  let ci: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    ci = save.charNames.indexOf("Markhe");
  });

  it.each([14, 1, 306, 0])("totalFromFlat = the tree's total on map %i", (map) => {
    const t = computeArkhAfkGains(save, ci, map).tree;
    expect(Math.abs(afkGainsModel.totalFromFlat(flattenTree(t)) - t.val)).toBeLessThanOrEqual(1e-12 * Math.max(1, t.val));
  });

  it.each([14, 306])("+100 pts on a fighting-pool source is +100/Σ on map %i", (map) => {
    const flat = flattenTree(computeArkhAfkGains(save, ci, map).tree);
    const path = `${AFK_ROOT} / ${AFK_NODES.pool} / Golden food (AllAFK)`;
    const { rows } = computeGains(afkGainsModel, flat, { [path]: flat[path] + 100 });
    expect(rows[0].gainPct).toBeCloseTo((100 / 8503.975457682378) * 100, 9); // +1.1759%
  });

  it("a town leaves Biggest Gains empty", () => {
    const town = flattenTree(computeArkhAfkGains(save, ci, 0).tree);
    const ref = flattenTree(computeArkhAfkGains(save, ci, 14).tree);
    const r = computeGains(afkGainsModel, town, ref);
    expect(r.rows).toEqual([]);
    expect(r.comparableSources).toBe(0);
  });
});

// Regression guard (controller note): the what-if engine's totalFromFlat must
// keep mirroring the descriptor's combine() on a second, independent capture.
describe.skipIf(!existsSync(SAVE_0924))("AFK what-if gains on the ARKHE save (2026-09-24, Markhe)", () => {
  it("totalFromFlat = the tree's total on map 14", () => {
    const save = JSON.parse(readFileSync(SAVE_0924, "utf8"));
    const ci = save.charNames.indexOf("Markhe");
    const t = computeArkhAfkGains(save, ci, 14).tree;
    expect(Math.abs(afkGainsModel.totalFromFlat(flattenTree(t)) - t.val)).toBeLessThanOrEqual(1e-12 * Math.max(1, t.val));
  });
});
