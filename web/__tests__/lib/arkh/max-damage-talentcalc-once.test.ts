import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { talent } from "@/lib/arkh/stats/systems/common/talent";
import { talentCalcTerms } from "@/lib/arkh/stats/systems/common/derived-damage";
import { MapDetails } from "@/lib/arkh/stats/data/game/customlists.js";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// N.js DamageDealed (offset ~4093000) adds TalentCalc(31) + TalentCalc(110) +
// GTN(1,125)·TalentCalc(125) + TalentCalc(485) + TalentCalc(305)/50 +
// TalentCalc(470)/10, TalentCalc(id) being GTN(1,id) × CalcTalentMAP[id]:
// each counter applies once. talent.resolve already returns these talents
// wrapped (× the counter), so the bare GTN is the "Talent Value" kid.
function gtn(id: number, charIdx: number): number {
  const n = talent.resolve(id, { saveData, charIdx });
  return (n.children || []).find((k) => k.name === "Talent Value")?.val ?? NaN;
}

// Items OnPlayStart3 pushes into Cards[1], so every played save has them.
const ENSURED = ["MaxCapBagT1", "MaxCapBag6", "MaxCapBagT2", "MaxCapBagM1", "EquipmentTools1", "OilBarrel4"];

describe("max damage applies each TalentCalc counter once", () => {
  beforeAll(() => {
    const req = (d: any) => Number(d?.[0]?.[0]) || 0;
    loadSaveData({
      charNames: ["T"],
      data: {
        CharacterClass_0: 1,
        Lv0_0: JSON.stringify([100, 50, 60, 70, 80, 90, 55, 65, 75, 85]),
        SL_0: JSON.stringify({ 31: 100, 110: 100, 125: 100, 305: 100, 470: 100, 485: 100 }),
        // Maps 1-2 (mushG, frogG) killed >100k times, every other map untouched.
        KLA_0: JSON.stringify((MapDetails as any[]).map((d, i) => [i === 1 || i === 2 ? -1e6 : req(d)])),
        CurrentMap_0: 3, // no AFK monster → talent 125's accuracy gate passes
        Refinery: JSON.stringify([[], [], [], [0, 5], [0, 3]]),
        Cards1: JSON.stringify([...ENSURED, "Copper", "GemP1", "CardsA0"]),
        // Save-envelope dicts can carry a "length" key that isn't a slot.
        StampLv: JSON.stringify([{ 0: 1, 1: 2, 2: 0, length: 3 }, [4], []]),
        CauldronInfo: JSON.stringify([[], [], [], [], { 0: 5, 1: 1, 2: 4, 3: 10, length: 4 }]),
      },
    });
  });

  it.each([
    [31, 10], // floor(lowest skill 50 / 5)
    [110, 2], // min(2 maps over 100k kills, GTN(2,110) = 100)
    [125, 8], // Σ Refinery[3..8][1]
    [305, 7 / 50], // 6 ensured + Copper (Gem*/Cards* dropped)
    [470, 3 / 10], // stamps > 0.5
    [485, 3], // vials > 3
  ])("TalentCalc(%i) = GTN × %d", (id, counter) => {
    expect(gtn(id, 0)).toBeGreaterThan(0);
    expect(talentCalcTerms(0, { saveData, charIdx: 0 })[id]).toBeCloseTo(gtn(id, 0) * counter, 6);
  });
});

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23: each char below holds exactly one of the six talents;
// the counter is N.js's CalcTalentMAP on this save.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("TalentCalc terms on a real save", () => {
  // Read in beforeAll: vitest still runs a skipped describe's body.
  let names: string[];
  beforeAll(() => {
    const save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    loadSaveData(save);
    names = save.charNames;
  });

  it.each([
    ["Warkhe", 31, 42], // floor(lowest skill 210 / 5)
    ["ARKHE", 110, 109], // min(109 maps over 100k kills, GTN(2,110) = 672)
    ["zArkhe", 125, 24253], // Σ Refinery ranks, accuracy gate passes
    ["farkhe", 485, 84], // 84 vials > 3 (not the envelope's "length": 88)
    ["Darkhe", 305, 1848 / 50], // 1850 items minus GemP37/GemP30
    ["Parkhe", 470, 120 / 10], // 120 stamps (StampLevelMAX > 0.5 agrees)
  ])("%s: TalentCalc(%i) = GTN × %d", (who, id, counter) => {
    const ci = names.indexOf(who);
    expect(talentCalcTerms(ci, { saveData, charIdx: ci })[id]).toBeCloseTo(gtn(id, ci) * counter, 6);
  });
});
