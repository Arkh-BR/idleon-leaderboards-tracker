// Synthetic saves for the AFK fidelity helpers (spec A4). This file never
// loads a real save: the arkh state is a singleton and loadSaveData doesn't
// reset every field, so each envelope spells out what it relies on.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { prayersReal, computePrayerReal } from "@/lib/arkh/stats/systems/w3/prayer";
import { chipBonuses, computeChipBonus } from "@/lib/arkh/stats/systems/w4/lab";
import { starSignBonusReal, computeStarSignBonus } from "@/lib/arkh/stats/systems/common/starSign";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("starSignBonusReal (FightAFK)", () => {
  const load = (signs: string, lv: number, extra: Record<string, unknown> = {}) =>
    loadSaveData({ charNames: ["A"], data: { PVtStarSign_0: signs, Lv0_0: [lv], StarSg: {}, ...extra } });
  const STAR_CHIP = { Lab: [[], [15, -1, -1, -1, -1, -1, -1]] }; // Silkrode Nanochip ("star")

  it("sign 54 equipped at or above the enabled count costs 7", () => {
    load("54", 120);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-7);
    expect(computeStarSignBonus("FightAFK", 0, saveData).val).toBe(6); // the DR's reading is untouched
  });

  it("sign 56 needs class level 100", () => {
    load("56", 99);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(0);
    load("56", 100);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(4);
  });

  it("a sign that isn't equipped (and no enabled signs) doesn't count", () => {
    load("12", 120);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(0);
  });

  it("one star chip with 0 enabled signs doubles the equipped positives, not a negative total", () => {
    load("19,28", 120, STAR_CHIP);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(16);
    load("19,54", 120, STAR_CHIP);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-5);
  });

  it("Seraph multiplies positive totals only", () => {
    load("19", 120, { StarSg: { Seraph_Cosmos: 1 } }); // Seraph 1.1 (no Arcane 40, summoning 0)
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBeCloseTo(2.2, 12);
    load("54", 120, { StarSg: { Seraph_Cosmos: 1 } });
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-7);
  });
});

describe("prayersReal", () => {
  const NONE = [-1, -1, -1, -1, -1, -1];
  // Prayer level 11 → scale 1 + 10/10 = 2. Gaming[12] holds the super bits
  // as N2L letters: 9 = "i", 39 = "M", 53 = "肥".
  const load = (prayers: number[], bits: string) =>
    loadSaveData({
      charNames: ["A"],
      data: {
        StarSg: {},
        Prayers_0: prayers,
        PrayOwned: [0, 0, 0, 0, 11, 11, 0, 0, 0, 0, 0, 0, 11],
        Gaming: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, bits],
      },
    });

  it("no prayer equipped + Super Bit 9: 0.2 × base × level scale", () => {
    load(NONE, "i");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(2); // round(0.2 · 5 · 2)
    expect(computePrayerReal(4, 0, 0, saveData).val).toBe(0); // the old helper stays equipped-only
  });

  it("Super Bits 9 + 39 + 53 add up", () => {
    load(NONE, "iM肥");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(6); // round(0.6 · 5 · 2)
  });

  it("curses, prayer 5 and a locked prayer give 0 in that branch", () => {
    load(NONE, "i");
    expect(prayersReal(12, 1, 0, saveData).val).toBe(0);
    expect(prayersReal(5, 0, 0, saveData).val).toBe(0);
    expect(prayersReal(0, 0, 0, saveData).val).toBe(0); // PrayOwned[0] = 0
  });

  it("an equipped prayer keeps the equipped branch", () => {
    load([4, -1, -1, -1, -1, -1], "i");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(10); // round(5 · 2)
  });

  it("Super Bit 53 alone doesn't open the branch", () => {
    load(NONE, "肥");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(0);
  });
});

describe("chipBonuses", () => {
  it("sums only the active character's lab chips", () => {
    loadSaveData({ charNames: ["A", "B"], data: { StarSg: {}, Lab: [[], [7, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1]] } });
    expect(chipBonuses("fafk", 0)).toBe(15); // Conductive Software
    expect(chipBonuses("fafk", 1)).toBe(0);
    expect(computeChipBonus("fafk")).toBe(15); // the account-wide helper is unchanged
  });

  it("counts chip 0 (only -1 is an empty slot)", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Lab: [[], [0, 0, -1, -1, -1, -1, -1]] } });
    expect(chipBonuses("def", 0)).toBe(20); // Grounded Nanochip ×2
  });
});
