import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { countVialsOver3, computeMaxDamage } from "@/lib/arkh/stats/systems/common/derived-damage";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import * as data from "@/lib/arkh/save/data";
import { talent } from "@/lib/arkh/stats/systems/common/talent";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("countVialsOver3", () => {
  it("counts array entries with lv > 3", () => {
    expect(countVialsOver3([13, 2, 5, 0])).toBe(2);
  });

  it("counts dict entries with lv > 3 (no length key present)", () => {
    expect(countVialsOver3({ "0": 13, "1": 2, "2": 5 })).toBe(2);
  });

  it('skips a numeric-looking "length" key in a dict (save envelope artifact)', () => {
    // Same 3 entries as above, plus a length key whose value (5) would
    // itself pass the > 3 filter if it were mistaken for a vial slot.
    expect(countVialsOver3({ "0": 13, "1": 2, "2": 5, length: 5 })).toBe(2);
  });
});

// Real save (gitignored golden cache); skips in CI where it's absent.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("talent-485 vial count against a real save", () => {
  let save: { charNames: string[] };
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    loadSaveData(save);
  });

  it("counts 84 vials, not 85 — CauldronInfo[4]'s spurious length key isn't a slot", () => {
    expect(countVialsOver3(data.cauldronInfoData[4])).toBe(84);
  });

  it("computeMaxDamage agrees whether CauldronInfo[4] is the loaded dict or an equivalent array, for every character not confounded by the separate calcTalent.ts bug", () => {
    const ci4 = data.cauldronInfoData[4];
    const asArray: number[] = [];
    for (const k in ci4) {
      if (isNaN(Number(k))) continue;
      asArray[Number(k)] = Number(ci4[k]) || 0;
    }
    for (let ci = 0; ci < save.charNames.length; ci++) {
      const ctx = { saveData, charIdx: ci };
      // Talent 485's own resolved value is wrapped against CalcTalentMAP[485]
      // (talent.resolve -> applyTalentWrap -> calcTalent.ts), a SEPARATE
      // re-derivation of this same vial count with the same length-key bug,
      // fixed independently on fix/calc-talent-length-key (PR #29, not yet
      // merged into main). Until that lands, a character with talent 485
      // invested is a second, unrelated confound this dict-vs-array swap
      // can't isolate from — skip them here. The real save's 84-vs-85 count
      // is asserted directly above regardless of this talent.
      let t485 = 0;
      try {
        t485 = talent.resolve(485, ctx).val;
      } catch {
        t485 = 0;
      }
      if (t485 > 0) continue;
      const withDict = computeMaxDamage(ci, ctx);
      data.cauldronInfoData[4] = asArray;
      const withArray = computeMaxDamage(ci, ctx);
      data.cauldronInfoData[4] = ci4; // restore before the next character's assertion
      expect(withArray).toBe(withDict);
    }
  });
});
