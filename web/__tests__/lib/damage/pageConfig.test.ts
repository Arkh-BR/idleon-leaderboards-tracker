import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";
import { damageGainsModel } from "@/lib/damage/gains";
import { formatDamage } from "@/lib/damage/format";
import { computeArkhDamage } from "@/lib/arkh/computeDamage";
import { DMG_NODES } from "@/lib/arkh/stats/defs/damage";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-11-01-postupdate.json";

describe("formatDamage (Player Info: ceil of Min and Max, game notation)", () => {
  it.each<[number, string]>([
    [0.2, "1"],
    [999998.2, "999,999"],
    [999999.4, "1.00M"],
    [1234567.2, "1.23M"],
    [2.776419535394748e34, "2.78e+34"],
  ])("%s → %s", (x, s) => expect(formatDamage(x)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatDamage(NaN)).toBe("—"));
});

describe("Damage page config", () => {
  it("has its own storage keys, copy and a bare unit", () => {
    expect(DAMAGE_PAGE.storage).toEqual({
      save: "damage-tracker.last-upload.v1",
      name: "damage-tracker.playerName",
      snapshots: "damage-tracker.v1",
      collapse: "damage.snapshot-section.collapsed.v1",
      exportPrefix: "damage-snapshots",
      exportLabel: "damage-tracker",
    });
    expect(DAMAGE_PAGE).toMatchObject({
      statName: "Damage",
      gainLabel: "Damage",
      emoji: "⚔️",
      calculatorTitle: "Damage Calculator",
      totalLabel: "Damage",
      unit: "",
      errPrefix: "Damage compute failed",
      mapTitle: "The map sets the Royal Guardian arena (map 43) and Clamworks' damage divider (map 306)",
    });
    expect(DAMAGE_PAGE.formatTotal).toBe(formatDamage);
    expect(DAMAGE_PAGE.gains).toBe(damageGainsModel);
    expect(DAMAGE_PAGE.methodologyNote).toMatch(/Active buffs \(Talents 108\/124\) and masterclass forms \(Wraith, Tempest, Tesseract\) are not counted/);
  });

  const tree = (max: number, mastery: number): ArkhNode => ({
    name: "Damage",
    val: max,
    children: [{ name: DMG_NODES.mastery, val: mastery }],
  });

  it("headline is Min ~ Max, Min = Max × Mastery; the tooltip has both in full", () => {
    expect(DAMAGE_PAGE.headline!(tree(2_000_000, 0.5), 2_000_000)).toBe("1.00M ~ 2.00M");
    expect(DAMAGE_PAGE.totalTitle!(2_000_000, tree(2_000_000, 0.5))).toBe("Min 1,000,000 ~ Max 2,000,000");
    // No Mastery node: a dash for Min, never NaN text.
    expect(DAMAGE_PAGE.headline!({ name: "Damage", val: 5 }, 5)).toBe("— ~ 5");
    expect(DAMAGE_PAGE.totalTitle!(5, null)).toBe("Min — ~ Max 5");
  });

  it("loads an (empty, until Task 7's collector fills it) Observed Max without throwing", async () => {
    const top = await DAMAGE_PAGE.loadTop();
    expect(top.flatForClass(null)).toEqual({});
    expect(top.flatForClass("Barbarian")).toEqual({});
    expect(DAMAGE_PAGE.topMeta).toEqual({ generatedAt: "", playersScanned: 0 });
  });
});

describe.skipIf(!existsSync(SAVE))("Damage page config on a real save", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
  });

  it("compute is computeArkhDamage, and the headline reads Mastery off its tree", async () => {
    const ci = save.charNames.indexOf("ARKHE");
    const r = await DAMAGE_PAGE.compute(save, ci, 0);
    expect(r.total).toBe(computeArkhDamage(save, ci, 0).total);
    const mastery = r.tree.children!.find((c) => c.name === DMG_NODES.mastery)!.val;
    expect(mastery).toBeGreaterThan(0);
    expect(DAMAGE_PAGE.headline!(r.tree, r.total)).toBe(`${formatDamage(r.total * mastery)} ~ ${formatDamage(r.total)}`);
    // The arena fixes Mastery at 0.2.
    const arena = await DAMAGE_PAGE.compute(save, ci, 43);
    expect(arena.tree.children!.find((c) => c.name === DMG_NODES.mastery)!.val).toBeCloseTo(0.2, 12);
  });
});
