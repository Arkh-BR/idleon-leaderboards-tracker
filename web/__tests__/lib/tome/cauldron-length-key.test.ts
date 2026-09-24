import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { rawVialTotalLv, rawBubbleTotalLv } from "@/lib/tome/extractors";
import { computeTome } from "@/lib/tome/compute";
import type { RawObj } from "@/lib/tome/math";

// CauldronInfo[0..4] (bubbles 0-3, vials 4) can deserialize as a
// {slot: lv, length: N} dict instead of a real array — an artifact of the
// save envelope, never an element the game itself reads (N.js loops
// `for (e = 0; e < CauldronInfo[i].length; e++)`, i.e. .length is only ever
// read once as the numeric loop bound; offset 5706979 of N.js for the vial
// loop). Skip it so it isn't counted as a bogus extra bubble/vial level.
describe('rawBubbleTotalLv / rawVialTotalLv skip the save envelope\'s bogus "length" key (synthetic)', () => {
  const data: RawObj = {
    CauldronInfo: [
      { "0": 1, "1": 2, length: 99 },
      { "0": 3, length: 99 },
      { "0": 4, length: 99 },
      { "0": 5, length: 99 },
      { "0": 10, "1": 20, length: 99 },
    ],
  };

  it("rawBubbleTotalLv sums only the numeric slots across CauldronInfo[0..3]", () => {
    // 1+2 + 3 + 4 + 5 = 15; a naive Object.keys sum would add 4×99 = 411 more.
    expect(rawBubbleTotalLv(data)).toBe(15);
  });

  it("rawVialTotalLv sums only the numeric slots of CauldronInfo[4]", () => {
    // 10+20 = 30; a naive Object.keys sum would add 99 more.
    expect(rawVialTotalLv(data)).toBe(30);
  });
});

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23 signed-in ("live") save: CauldronInfo[0..4] all
// deserialize as {slot: lv, length: N} dicts.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))(
  "rawBubbleTotalLv / rawVialTotalLv on a real signed-in save (length-key regression)",
  () => {
    let envelope: { data: RawObj };
    let data: RawObj;
    beforeAll(() => {
      envelope = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
      data = envelope.data;
    });

    it('excludes CauldronInfo[4]\'s bogus "length":88 from the vial total', () => {
      // Before the fix this read 1169 (1081 real levels + the length key).
      expect(rawVialTotalLv(data)).toBe(1081);
    });

    it('excludes CauldronInfo[0..3]\'s bogus "length" keys from the bubble total', () => {
      // Before the fix this read 16677601 (16677437 real levels + 41+40+42+41).
      expect(rawBubbleTotalLv(data)).toBe(16677437);
    });

    it("Total Vial LV / Total Bubble LV pts are unchanged (both formulas were already saturated)", () => {
      // Tome: [962,2,600] (min(1, q/962)) and [1E6,4,1750] both hit pct=1 well
      // before either raw value, buggy or fixed — the "length" over-count
      // changed the displayed raw value but not the score on this account.
      const result = computeTome(envelope);
      const vial = result.rows.find((r) => r.task === "Total Vial LV")!;
      const bubble = result.rows.find((r) => r.task === "Total Bubble LV")!;
      expect(vial.rawValue).toBe(1081);
      expect(vial.pts).toBe(600);
      expect(bubble.rawValue).toBe(16677437);
      expect(bubble.pts).toBe(1750);
    });
  }
);
