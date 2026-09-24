import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { gfoodBonusMULTIBreakdown } from "@/lib/arkh/stats/systems/common/goldenFood";
import { computeAllTalentLVz } from "@/lib/arkh/stats/systems/common/talent";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// N.js rebuilds DNSM.FamBonusQTYs by walking the characters in save order. A
// raw value only replaces the stored one when it beats it (the stored value
// can already carry an earlier character's buff), and The Family Guy (talent
// 144) only buffs the value the ACTIVE character sets. GetTalentNumber(1,144)
// is read mid-walk, so its AllTalentLV sees FamBonusQTYs["68"] as stored then.
const ARCANE_CULTIST = 40; // Shaman line: FamBonusQTYs["66"], golden food
const ELEMENTAL_SORCERER = 34; // FamBonusQTYs["68"], all talent levels
const FAMILY_GUY_LV = 400;

const shaman66 = (lv: number) => 1 + (0.4 * (lv - 29)) / (lv - 29 + 100); // decayMulti(0.4, 100), offset 29
const sorcerer68 = (lv: number) => (20 * (lv - 69)) / (lv - 69 + 350); // decay(20, 350), offset 69
const familyGuy = (lv: number) => (40 * lv) / (lv + 100); // decay(40, 100)

function load(chars: [cls: number, lv: number][]) {
  const data: Record<string, unknown> = {};
  chars.forEach(([cls, lv], ci) => {
    data[`CharacterClass_${ci}`] = cls;
    data[`Lv0_${ci}`] = [lv];
    data[`SL_${ci}`] = JSON.stringify({ 144: FAMILY_GUY_LV });
  });
  loadSaveData({ charNames: chars.map((_, ci) => `Char${ci}`), data });
}

describe("golden food's Shaman family bonus (FamBonusQTYs 66) follows the save-order walk", () => {
  const family66 = (ci: number) => gfoodBonusMULTIBreakdown(ci, saveData).items[1].val;

  it("gives a weaker Arcane Cultist behind a stronger one no Family Guy buff", () => {
    load([[ARCANE_CULTIST, 1825], [ARCANE_CULTIST, 1804]]);
    expect(family66(1)).toBeCloseTo(shaman66(1825), 10);
  });

  it("reads the active character's talent before a later sorcerer's 68 is stored", () => {
    load([[ARCANE_CULTIST, 1825], [ELEMENTAL_SORCERER, 1803]]);
    expect(family66(0)).toBeCloseTo(shaman66(1825) * (1 + familyGuy(FAMILY_GUY_LV) / 100), 10);
  });
});

describe("the sorcerer family bonus in added talent levels (FamBonusQTYs 68) follows the save-order walk", () => {
  // In this bare save the family bonus is the only added-level source.
  const addedLevels = (ci: number) => computeAllTalentLVz(328, ci, undefined, saveData);
  const buffed68 = (lv: number) =>
    sorcerer68(lv) * (1 + familyGuy(FAMILY_GUY_LV + Math.floor(sorcerer68(lv))) / 100);

  it("keeps an earlier, lower sorcerer's buff that a later raw value cannot beat", () => {
    load([[ELEMENTAL_SORCERER, 1790], [ELEMENTAL_SORCERER, 1802]]);
    expect(sorcerer68(1802)).toBeLessThan(buffed68(1790));
    expect(addedLevels(0)).toBe(Math.floor(buffed68(1790)));
  });

  it("buffs a later sorcerer whose raw value beats the stored one", () => {
    load([[ELEMENTAL_SORCERER, 1790], [ELEMENTAL_SORCERER, 1802]]);
    expect(addedLevels(1)).toBe(Math.floor(buffed68(1802)));
  });
});
