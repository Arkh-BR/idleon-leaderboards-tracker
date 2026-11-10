import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeTome } from "@/lib/tome/compute";

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23 signed-in ("live") save: CauldronInfo[0..4] all
// deserialize as {slot: lv, length: N} dicts.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))(
  "Total Bubble LV / Total Vial LV on a real signed-in save (length-key regression)",
  () => {
    let envelope: Record<string, unknown>;
    beforeAll(() => {
      envelope = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    });

    it("Total Vial LV / Total Bubble LV pts are unchanged (both formulas were already saturated)", () => {
      // Tome: [962,2,600] (min(1, q/962)) and [1E6,4,1750] both hit pct=1 well
      // before either raw value, buggy or fixed — the "length" over-count
      // changed the displayed raw value but not the score on this account.
      const result = computeTome(envelope as never);
      const vial = result.rows.find((r) => r.task === "Total Vial LV")!;
      const bubble = result.rows.find((r) => r.task === "Total Bubble LV")!;
      expect(vial.rawValue).toBe(1081);
      expect(vial.pts).toBe(600);
      expect(bubble.rawValue).toBe(16677437);
      expect(bubble.pts).toBe(1750);
    });
  }
);
