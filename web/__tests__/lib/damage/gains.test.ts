import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { damageGainsModel } from "@/lib/damage/gains";
import { computeArkhDamage } from "@/lib/arkh/computeDamage";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { DMG_LAYERS, DMG_NODES, DMG_RAT, DMG_ROOT, DMG_RULES } from "@/lib/arkh/stats/defs/damage";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const DIR = "scripts/updater/golden/.cache/";
// Arlong's save has Menagerie[5][2] > 0: its map 306 divides Max by 1e8 (the
// ARKHE save's divisor is 1, which leaves map 306 = map 0 and proves little).
const CASES: Record<string, string[]> = {
  "arkhe-live-2026-11-01-postupdate.json": ["ARKHE", "farkhe", "Warkhe"],
  "Arlong.json": ["Arlong"],
};
const MAPS = [0, 14, 43, 306];
const BUFF = "Buff 108 (active buff only)";

const rel = (a: number, b: number) => Math.abs(a / b - 1);

for (const [file, chars] of Object.entries(CASES)) describe.skipIf(!existsSync(DIR + file))(`Damage what-if gains model on a real save — ${file}`, () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(DIR + file, "utf8").replace(/^﻿/, ""));
  });
  const treeOf = (name: string, map: number) => {
    const ci = save.charNames.indexOf(name);
    expect(ci).toBeGreaterThanOrEqual(0);
    return computeArkhDamage(save, ci, map).tree;
  };

  describe.each(chars)("%s", (name) => {
    it.each(MAPS)("map %i: totalFromFlat(flat tree) = the tree's Max (1e-9)", (map) => {
      const tree = treeOf(name, map);
      expect(Number.isFinite(tree.val) && tree.val > 0).toBe(true);
      expect(rel(damageGainsModel.totalFromFlat(flattenTree(tree)), tree.val)).toBeLessThan(1e-9);
    });

    it.each(MAPS)("map %i: replacedBy is set only on map 43", (map) => {
      const flat = flattenTree(treeOf(name, map));
      expect(damageGainsModel.replacedBy!(flat)).toBe(map === 43 ? DMG_RAT.name : null);
    });

    it("sources: only stat sources — no cap, rat, mastery, pow or buff rows", () => {
      const flat = flattenTree(treeOf(name, 0));
      const sources = damageGainsModel.sources(flat, flat);
      expect(sources.length).toBeGreaterThan(80);
      const groups = new Set(DMG_LAYERS.flatMap((l) => l.steps.filter((s) => s.kind !== "cap" && s.kind !== "pow").map((s) => s.name)));
      const rules = new Set<string>(Object.values(DMG_RULES));
      for (const s of sources) {
        expect(groups.has(s.group)).toBe(true);
        expect(rules.has(s.source)).toBe(false);
        expect(s.source).not.toBe(BUFF);
        expect(s.path.startsWith(`${DMG_ROOT} / ${DMG_RAT.name}`)).toBe(false);
        expect(s.path.startsWith(`${DMG_ROOT} / ${DMG_NODES.mastery}`)).toBe(false);
        expect(s.path.startsWith(`${DMG_ROOT} / ${DMG_RULES.relic}`)).toBe(false);
        expect(flat).toHaveProperty([s.path]);
      }
      // The pow group's one item and the buff are in the tree but never offered.
      expect(sources.some((s) => s.group === DMG_RULES.relic)).toBe(false);
      expect(flat).toHaveProperty([`${DMG_ROOT} / ${DMG_NODES.mult} / Buffs, Friends & Star Signs / ${BUFF}`]);
    });

    it("display follows the group kind: pct → pct, add → raw, mult → x", () => {
      const flat = flattenTree(treeOf(name, 0));
      const by = (source: string) => damageGainsModel.sources(flat, flat).find((s) => s.source === source);
      expect(by("Statue 22")?.display).toBe("pct");
      expect(by("Weapon Power²")?.display).toBe("raw");
      expect(by("Workbench (Extra Damage)")?.display).toBe("x");
    });

    it("swapping a pct source for a bigger value raises the total", () => {
      const flat = flattenTree(treeOf(name, 0));
      const src = damageGainsModel.sources(flat, flat).find((s) => s.display === "pct" && s.source === "Statue 22")!;
      const base = damageGainsModel.totalFromFlat(flat);
      expect(damageGainsModel.totalFromFlat({ ...flat, [src.path]: flat[src.path] + 1e6 })).toBeGreaterThan(base);
      // …and computeGains reports it, with the reference value as `max`.
      const { rows } = computeGains(damageGainsModel, flat, { ...flat, [src.path]: flat[src.path] + 1e6 });
      expect(rows.find((r) => r.path === src.path)).toMatchObject({ you: flat[src.path], max: flat[src.path] + 1e6 });
    });

    it("map 43: nothing to rank — the arena replaces Max", () => {
      const flat = flattenTree(treeOf(name, 43));
      const boosted = Object.fromEntries(Object.entries(flat).map(([p, v]) => [p, v * 2]));
      expect(computeGains(damageGainsModel, flat, boosted).rows).toEqual([]);
    });
  });

  if (file === "Arlong.json")
    it("map 306 divides Max by 1e8, and the what-if follows", () => {
      const at = (map: number) => treeOf("Arlong", map);
      expect(rel(at(306).val * 1e8, at(0).val)).toBeLessThan(1e-9);
      expect(damageGainsModel.replacedBy!(flattenTree(at(306)))).toBeNull();
    });
});
