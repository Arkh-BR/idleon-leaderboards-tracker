// Synthetic (no private save needed) — divinityMinorFor is the N.js
// "Bonus_Minor" single-player branch (charIdx != -1), added in EXP Multi
// Task 3 fix round 1 for exp.ts's divMinor4 (see exp-multi.save.test.ts for
// the N.js-derived value against the real save).
import { describe, it, expect, beforeAll } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { divinityMinorFor } from "@/lib/arkh/stats/systems/coin/divinityMinor";
import type { SaveData } from "@/lib/arkh/state";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// N.js Divinity[.+12] linked-god slot and Divinity[25] (unlocked deities)
// both come from the shared `divinityData` module — reset to [] via a real
// (empty) load so neither test observes another file's leftover state.
beforeAll(() => loadSaveData({ charNames: ["A"], data: {} }));

const mock = (companion0: boolean): SaveData =>
  ({
    companionIds: companion0 ? new Set([0]) : new Set(),
    companionLv2Ids: new Set(),
    lv0AllData: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 795]], // [14] = worship level
    holesData: [],
    gemItemsData: [],
    cauldronBubblesData: [],
  }) as unknown as SaveData;

describe("divinityMinorFor (Bonus_Minor, charIdx != -1)", () => {
  it("is 0 without the 'everyone' override and no linked god", () => {
    expect(divinityMinorFor(0, 4, mock(false))).toBe(0);
  });

  it("is nonzero once companion 0 is owned — its 'everyone' override applies to any type", () => {
    expect(divinityMinorFor(0, 4, mock(true))).toBeGreaterThan(0);
  });
});
