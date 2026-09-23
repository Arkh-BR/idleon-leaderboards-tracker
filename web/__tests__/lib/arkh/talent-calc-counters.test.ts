import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { talent, maxTalentBonus } from "@/lib/arkh/stats/systems/common/talent";
import { computeCalcTalent } from "@/lib/arkh/stats/systems/common/calcTalent";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { MapDetails } from "@/lib/arkh/stats/data/game/customlists.js";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// N.js TalentCalc MAP build (~4451850): over the maps whose AFK target is a
// monster (stopping at the active player's KillsLeft2Advance length), count
// the FIGHTING ones with MapDetails[g][0][0] − KLA[g][0] ≥ 1e5 / 1e6 on the
// active player (110 / 146, capped at GetTalentNumber(2,id)), and ≥ 1e9 on
// the last Death-Bringer-line player (209).
const kla = (kills: Record<number, number>) =>
  JSON.stringify((MapDetails as any[]).map((d, m) => [(Number(d?.[0]?.[0]) || 0) - (kills[m] || 0)]));

describe("Apocalypse counters (110/146/209)", () => {
  beforeAll(() => {
    loadSaveData({
      charNames: ["D", "E"],
      data: {
        // D: Death Bringer line; 110/146 at raw LV 1, and Symbols of Beyond ~R
        // (149) at 100 adds 1 + floor(100/20) = 6 levels → GTN(2,id) = 7.
        CharacterClass_0: 14,
        SL_0: JSON.stringify({ 110: 1, 146: 1, 149: 100, 209: 100 }),
        KLA_0: kla({ 1: 2e5, 2: 2e6, 13: 2e6, 9: 3e9 }),
        // E: 5 FIGHTING maps over 1e9 (map 9 has no kill requirement), plus a
        // mining map (6) and a map with no AFK monster (3), which never count.
        CharacterClass_1: 1,
        SL_1: JSON.stringify({ 110: 100, 146: 100 }),
        KLA_1: kla({ 1: 5e9, 2: 5e9, 8: 5e9, 9: 5e9, 13: 5e9, 6: 5e9, 3: 5e9 }),
      },
    });
  });

  it("110/146 count the active char's kills on FIGHTING maps", () => {
    expect(computeCalcTalent(110, 1, saveData)).toBe(5);
    expect(computeCalcTalent(146, 1, saveData)).toBe(5);
  });

  it("110/146 cap at GetTalentNumber(2,id), bonus levels included", () => {
    expect(computeCalcTalent(110, 0, saveData)).toBe(4); // maps 1, 2, 13, 9 ≤ 7
    expect(computeCalcTalent(146, 0, saveData)).toBe(3); // maps 2, 13, 9 ≤ 7
  });

  it("209 counts the Death Bringer's maps over 1e9, whoever is active", () => {
    expect(computeCalcTalent(209, 0, saveData)).toBe(1); // D's map 9, not E's 5
    expect(computeCalcTalent(209, 1, saveData)).toBe(1);
  });
});

const node = (id: number, ci: number) => talent.resolve(id, { saveData, charIdx: ci });
const kid = (n: ArkhNode, name: string) => n.children?.find((k) => k.name === name)?.val ?? NaN;

// N.js tooltips (~7195614, ~7198211) show GTN(1,305)·(MAP/50) and
// GTN(1,470)·(MAP/10): the same /50 and /10 as DamageDealed.
describe("305/470 headlines carry DamageDealed's /50 and /10", () => {
  beforeAll(() => {
    loadSaveData({
      charNames: ["T"],
      data: {
        SL_0: JSON.stringify({ 305: 100, 470: 100 }),
        Cards1: JSON.stringify(["Copper", "Iron", "GemP1", "CardsA0"]),
        StampLv: JSON.stringify([[1, 2, 0], [4], []]),
      },
    });
  });

  it("305 = GTN × 2 items / 50", () => {
    const t305 = node(305, 0);
    expect(t305.val).toBeCloseTo((kid(t305, "Talent Value") * 2) / 50, 6); // Copper, Iron
  });

  it("470 = GTN × 3 stamps / 10", () => {
    const t470 = node(470, 0);
    expect(t470.val).toBeCloseTo((kid(t470, "Talent Value") * 3) / 10, 6);
  });
});

// Real saves (gitignored golden cache); skip in CI where they're absent.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";
const DR_SAVE = "scripts/updater/golden/.cache/arkhe-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("talent counters on a real save", () => {
  // Read in beforeAll: vitest still runs a skipped describe's body.
  let names: string[];
  beforeAll(() => {
    const save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    loadSaveData(save);
    names = save.charNames;
  });

  it("ARKHE (the Death Bringer) counts 109 maps over 100k and 1m kills", () => {
    const ci = names.indexOf("ARKHE");
    expect(computeCalcTalent(110, ci, saveData)).toBe(109);
    expect(computeCalcTalent(146, ci, saveData)).toBe(109);
  });

  it("209 reads ARKHE's 106 maps over 1e9 for every character", () => {
    for (let ci = 0; ci < names.length; ci++) expect(computeCalcTalent(209, ci, saveData)).toBe(106);
  });

  it("Darkhe's 305 headline divides by 50", () => {
    const t305 = node(305, names.indexOf("Darkhe"));
    expect(t305.val).toBeCloseTo((kid(t305, "Talent Value") * kid(t305, "Items Ever Found")) / 50, 6);
  });

  it("Parkhe's 470 headline divides by 10", () => {
    const t470 = node(470, names.indexOf("Parkhe"));
    expect(t470.val).toBeCloseTo((kid(t470, "Talent Value") * kid(t470, "Stamps In Collection")) / 10, 6);
  });
});

describe.skipIf(!existsSync(DR_SAVE))("209 counter matches Drop Rate's golden food", () => {
  let save: { charNames: string[] };
  beforeAll(() => {
    save = JSON.parse(readFileSync(DR_SAVE, "utf8").replace(/^﻿/, ""));
  });

  // N.js golden food (~5033603) adds getbonus2(1,209,-1) × CalcTalentMAP["209"],
  // and DR on this save matches the game to the cent (family-guy-dr.test.ts).
  it("Markhe on map 14: Talent 209 × Maps = getbonus2 × the 209 counter", () => {
    const ci = save.charNames.indexOf("Markhe");
    const find = (n: ArkhNode): ArkhNode | null =>
      n.name === "Talent 209 × Maps" ? n : (n.children || []).map(find).find(Boolean) || null;
    const gf = find(computeArkhDropRate(save, ci, 14).tree)!.val; // loads DR_SAVE
    expect(gf).toBeGreaterThan(0);
    expect(maxTalentBonus(209, ci, saveData) * computeCalcTalent(209, ci, saveData)).toBeCloseTo(gf, 6);
  });
});
