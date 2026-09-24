import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getClassExpMulti on this exact file
// for Markhe on map 14, unless a comment says N.js ≠ IT.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("EXP Multi — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  let save: any;
  let markheIdx: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    markheIdx = save.charNames.indexOf("Markhe");
    tree = computeArkhExpMulti(save, markheIdx, 14).tree;
  });

  const src = (id: string): number => {
    const gi = EXP_GROUPS.findIndex((x) => x.sources.includes(id));
    const si = EXP_GROUPS[gi].sources.indexOf(id);
    return Number(tree.children![gi].children![si].val);
  };
  const group = (key: string): number => Number(tree.children![EXP_GROUPS.findIndex((x) => x.key === key)].val);
  const close = (actual: number, expected: number) => {
    if (expected === 0) expect(actual).toBe(0);
    else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
  };

  it.each([
    ["workbench", () => src("workbench"), 1.2810767773188114],
    ["bundle + superbit group", () => group("g02"), 1.2],
    ["shiny medallions", () => src("medallion429"), 2.998997995991984],
    ["companion 37 (Panda, 1+9c)", () => src("comp37"), 10],
    ["companion 33", () => src("comp33"), 2],
    ["companion 160 (1+4c)", () => src("comp160"), 5],
    ["companion 32", () => src("comp32"), 2],
    ["companion 34", () => src("comp34"), 3],
    ["companion 128 (Baby Troll)", () => src("comp128"), 1.5],
    ["research grid", () => src("gridExp"), 1.8394750000000002],
    ["super bit 63", () => src("superbit63"), 1.1],
    ["zenith market 9", () => src("zenith9"), 1.76],
    ["companion 50 clamp", () => src("comp50"), 1.01],
    ["etc 84", () => src("etc84"), 2.4222944561555217],
    ["arcade 60", () => src("arcade60"), 2.0049751243781095],
    ["vial 7classexp", () => src("vialClassExp"), 1.5096],
    ["slayer abominator", () => src("talent434"), 3.698020324806719],
    ["arcane slot 1 (map 14)", () => src("arcane1"), 1],
    ["big fish 4", () => src("bigFish4"), 1.1789772727272727],
    ["coral kid ^ god rank", () => src("coralKid"), 64.8521248076352],
    ["card set 12", () => src("cardSet12"), 1],
    ["sushi 15", () => src("sushi15"), 1.25],
    ["equinox cloud 70", () => src("cloud70"), 1.05],
    ["fountain 16", () => src("fountain16"), 25.6],
    ["royal statue 3", () => src("royalStatue3"), 1],
    ["classy discoveries", () => src("classy"), 21.630739610601516],
    ["etc 78 (%)", () => src("etc78"), 1514.3679816528827],

    // Not in IT's breakdown — derived directly from N.js + this save (values
    // printed via a throwaway script calling computeArkhExpMulti(save,8,14)).
    // not in IT's breakdown — N.js (1+.4·Companions(168)), save: companionIds
    // has 168 and companionLv2Ids has 168 → companions(168,s)=1.5 (LV2 value,
    // CompanionDB[168][11]) → 1+0.4×1.5=1.6
    ["companion 168 (0.4·comp, owned+LV2)", () => src("comp168"), 1.6],
    // not in IT's breakdown — N.js (1+Companions(145)), save: companionIds
    // has 145 (no LV2 entry) → companions(145,s)=2 → 1+2=3
    ["companion 145", () => src("comp145"), 3],
    // not in IT's breakdown — N.js (1+JellyOperation("RoG_BonusQTY",30,0)/100),
    // save: Research[7][9]=24 successful obstructions; 24 is not > 30 so
    // obstruction 30 is still locked → bonus 0 → 1+0/100=1
    ["jelly operation 30 (locked, 24 ops)", () => src("jelly30"), 1],
    // not in IT's breakdown — N.js (1+JellyOperation("RoG_BonusQTY",62,0)/100),
    // save: 24 is not > 62 → locked → bonus 0 → 1
    ["jelly operation 62 (locked, 24 ops)", () => src("jelly62"), 1],
    // not in IT's breakdown — N.js (1+CardBonusREAL(100)/100), save: no card
    // equipped on Markhe maps to IDforCardBonus["100"]="+{%_Class_EXP_Multi"
    // (computeCardBonusByType(100,ci,s).val=0) → 1+0/100=1
    ["card type 100 (Class EXP Multi, none equipped)", () => src("card100"), 1],
  ])("%s", (_n, get, expected) => close(get(), expected));
});
