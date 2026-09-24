// Synthetic saves for the AFK fidelity helpers (spec A4). This file never
// loads a real save: the arkh state is a singleton and loadSaveData doesn't
// reset every field, so each envelope spells out what it relies on.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { prayersReal, computePrayerReal } from "@/lib/arkh/stats/systems/w3/prayer";
import { chipBonuses, computeChipBonus } from "@/lib/arkh/stats/systems/w4/lab";
import { starSignBonusReal, computeStarSignBonus } from "@/lib/arkh/stats/systems/common/starSign";
import { setBonus } from "@/lib/arkh/stats/systems/w3/setBonus";
import { bonusMajorReal, hasBonusMajor } from "@/lib/arkh/stats/systems/w5/divinity";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("starSignBonusReal (FightAFK)", () => {
  const load = (signs: string, lv: number, extra: Record<string, unknown> = {}) =>
    loadSaveData({ charNames: ["A"], data: { PVtStarSign_0: signs, Lv0_0: [lv], StarSg: {}, ...extra } });
  const STAR_CHIP = { Lab: [[], [15, -1, -1, -1, -1, -1, -1]] }; // Silkrode Nanochip ("star")
  // enabledStarSigns > 29: Rift[0] >= 10 unlocks a baseline of 5
  // (getEnabledStarSigns), plus a shiny-pet "+{ Infinite Star Signs" bonus
  // (category 3) of round(20 · 2) = 40 from one maxed-out World 1 Squirrel
  // (PET_SHINY_TYPE[0][1] = type 2, SHINY_BONUS_PER_LV[2] = 2, exp 1e15 forces
  // the top shiny level, 20) — enabled = 5 + 40 = 45 (verified against
  // getEnabledStarSigns directly; the shiny-bonus arithmetic itself is
  // pre-existing w4/breeding.ts code, out of Task 3's scope). This puts
  // signs 19 and 29 (indices 19, 29) inside the unlocked range [0, 45).
  const ENABLED_45: Record<string, unknown> = (() => {
    const breeding: number[][] = [];
    breeding[22] = [];
    breeding[22][1] = 1e15;
    return { Rift: [10], Breeding: breeding };
  })();

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

  // N.js builds StarSignsDL as equipped (PVtStarSign) UNION every k <
  // enabledStarSigns whose CustomLists.StarSigns[k][0] name is a key of
  // StarSignsUnlocked (starsigns_fn.txt lines 2-3: the `f<g` loop pushes `k`
  // onto StarSignsDL when `StarSignsUnlocked.h[name]` exists). A sign in that
  // unlocked range counts exactly like an equipped one — the two tests below
  // never equip anything (PVtStarSign_0 = "").
  it("an unlocked sign below the enabled count counts even when it isn't equipped", () => {
    // N.js: D.contains(StarSignsDL,"19") → StarSigns.FightAFK = 2 + ... —
    // no enabled-count gate on sign 19, so being in the DL is enough.
    load("", 120, { ...ENABLED_45, StarSg: { Silly_Snoozer: 1 } }); // sign 19's name
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(2);

    // Same sign, but its name is absent from StarSignsUnlocked this time:
    // the unlocked-range loop never pushes "19" onto StarSignsDL, and it
    // isn't equipped either, so D.contains(StarSignsDL,"19") is false.
    load("", 120, { ...ENABLED_45, StarSg: {} });
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(0);
  });

  it("a negative sign only applies once its own index reaches the enabled count, unlocked or not", () => {
    // N.js: D.contains(StarSignsDL,"29") → { if (29 > enabledStarSigns-1) {
    // StarSigns.FightAFK -= 6 } } — being in the DL (here, via the unlocked
    // range: enabled=45 puts 29 inside [0,45)) is NOT sufficient; the −6 line
    // itself is gated on 29 >= enabledStarSigns, which is false at 45.
    load("", 120, { ...ENABLED_45, StarSg: { Mr_No_Sleep: 1 } }); // sign 29's name
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(0);

    // Equip sign 29 directly instead (no Rift ⇒ enabledStarSigns = 0, so
    // 29 > 0-1 holds): the same −6 line now applies.
    load("29", 120);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-6);
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

describe("Void Set (setBonus 'void', spec A11)", () => {
  // VOID_SET = 4 armor pieces + 2 of its tools + 1 of its weapons (EquipmentSets[3] = ["2","1","10",…]).
  const gear = (weapon: string) => ({
    charNames: ["A"],
    data: {
      StarSg: {},
      EquipOrder_0: [
        ["EquipmentHats54", weapon, "EquipmentShirts27", "EquipmentPants21", "EquipmentShoes22"],
        ["EquipmentTools11", "EquipmentToolsHatchet7"],
      ],
    },
  });

  it("is unlocked by the 7 worn parts, without OLA[379]", () => {
    loadSaveData(gear("EquipmentSword3"));
    expect(setBonus.resolve("void", { saveData, charIdx: 0 }).val).toBe(10);
  });

  it("needs the weapon: armor + tools alone are 6 of 7 parts", () => {
    loadSaveData(gear("Blank"));
    expect(setBonus.resolve("void", { saveData, charIdx: 0 }).val).toBe(0);
  });
});

describe("bonusMajorReal", () => {
  it("Gem Shop item 9 turns on the type-0 major only", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, GemItemsPurchased: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(true);
    expect(bonusMajorReal(0, 2, saveData)).toBe(false);
    expect(hasBonusMajor(0, 0, saveData)).toBe(false); // the DR helper is untouched
  });

  it("Polytheism: talent 505's god (SL505 mod 10) while the god rank is past it", () => {
    const div = Array(26).fill(0);
    div[12] = 1; // char 0 linked to Arctis (type 2), so hasBonusMajor(…, 0) is false
    div[25] = 3;
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Divinity: div, SL_0: { 505: 10 } } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(true); // god 0 = Snehebatu (type 0), 3 > 0
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Divinity: div, SL_0: { 505: 11 } } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(false); // god 1 is type 2
    const unlinked = [...div];
    unlinked[12] = -1;
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Divinity: unlinked, SL_0: { 505: 10 } } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(false); // not linked → no Polytheism
  });
});
