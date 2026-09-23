import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeCalcTalent } from "@/lib/arkh/stats/systems/common/calcTalent";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// StampLv/CauldronInfo can deserialize as a {slot: lv} dict instead of a
// real array, and on a signed-in save that dict can carry a "length" key
// alongside the numeric slot keys (e.g. {"0":5,"40":10,"length":41}) — an
// artifact of the save envelope, never an element the game itself reads
// (N.js loops `for (t = arr.length; f < t; )`, i.e. `.length` is only ever
// read once as the numeric loop bound). Talents 470 and 485 must skip it.
describe('calcTalent 470/485 skip the save envelope\'s bogus "length" key (synthetic)', () => {
  beforeAll(() => {
    loadSaveData({
      charNames: ["Rg"],
      data: {
        // StampLv cat 0 as a dict with a "length" key; cats 1/2 absent so
        // only cat 0 contributes to the count.
        StampLv: JSON.stringify({ "0": { "0": 5, length: 41 } }),
        // CauldronInfo[4] (vials) with the same shape quirk.
        CauldronInfo: JSON.stringify([[], [], [], [], { "0": 5, "40": 10, length: 41 }]),
      },
    });
  });

  it('470 (Paperwork, Great...) counts only real stamp slots, not "length"', () => {
    // 1 real entry (>0.5) in cat 0; "length":41 would add a bogus 2nd if counted.
    expect(computeCalcTalent(470, 0, saveData)).toBe(1);
  });

  it('485 (Virile Vials) counts only real vial slots, not "length"', () => {
    // 2 real entries (>3): slots 0 and 40; "length":41 would add a bogus 3rd.
    expect(computeCalcTalent(485, 0, saveData)).toBe(2);
  });
});

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23 signed-in save: all 3 StampLv categories AND
// CauldronInfo[4] deserialize as {slot: lv, length: N} dicts.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))(
  "calcTalent 470/485 on a real signed-in save (length-key regression)",
  () => {
    beforeAll(() => {
      const save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
      loadSaveData(save);
    });

    it('470 excludes the 3 bogus "length" entries (one per StampLv category)', () => {
      // Before the fix this read 123 (120 real entries + 3 "length" keys,
      // one per category — cat lengths 44/57/27 all > 0.5).
      expect(computeCalcTalent(470, 0, saveData)).toBe(120);
    });

    it('485 excludes the 1 bogus "length" entry (CauldronInfo[4])', () => {
      // Before the fix this read 85 (84 real entries + CauldronInfo[4]'s
      // "length":88, which is > 3 so it was miscounted as an owned vial).
      expect(computeCalcTalent(485, 0, saveData)).toBe(84);
    });
  }
);
