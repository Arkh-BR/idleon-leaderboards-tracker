// Synthetic saves for the Multikill ports (spec M6). This file never loads a
// real save: the arkh state is a singleton and loadSaveData doesn't reset
// every field, so each envelope spells out what it relies on.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { overkillQTY } from "@/lib/arkh/stats/systems/coin/gambit";
import { saltLick } from "@/lib/arkh/stats/systems/exp/saltLick";
import { getBuffBonuses } from "@/lib/arkh/stats/systems/common/buffs";
import { starSignBonusReal } from "@/lib/arkh/stats/systems/common/starSign";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { MK_POOLS } from "@/lib/arkh/stats/defs/multikill";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("overkillQTY — the Death Note pages", () => {
  it("7 = the minibosses: table 7842 over the first 10 Ninja[105] entries (NinjaInfo[30])", () => {
    const ninja: unknown[] = [];
    ninja[105] = [99, 100, 250, 1e3, 5e3, 25e3, 1e5, 1e6, 0, 0, 1e9, 1e9];
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Ninja: ninja } });
    expect(overkillQTY(7, saveData)).toBe(0 + 1 + 2 + 3 + 4 + 5 + 7 + 10);
  });

  it("a world page without kills is 0", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {} } });
    expect(overkillQTY(0, saveData)).toBe(0);
  });
});

describe("saltLick(i) — N.js SaltLick", () => {
  it("is the level × SaltLicks[i][3]", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, SaltLick: [0, 0, 0, 5, 0, 0, 0, 0, 7] } });
    expect(saltLick(8, saveData)).toBe(21); // 3 per level
    expect(saltLick(3, saveData)).toBeCloseTo(1, 12); // .2 per level (EXP's term)
    expect(saltLick(0, saveData)).toBe(0);
  });
});

describe("starSignBonusReal — the Multikill keys", () => {
  it("sign 47 gives 15 and sign 78 gives 3 when equipped; nothing otherwise", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, PVtStarSign_0: "47,78", Lv0_0: [100] } });
    expect(starSignBonusReal("MultiKill", 0, saveData).val).toBe(15);
    expect(starSignBonusReal("78", 0, saveData).val).toBe(3);
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, PVtStarSign_0: "12", Lv0_0: [100] } });
    expect(starSignBonusReal("MultiKill", 0, saveData).val).toBe(0);
  });
});

describe("getBuffBonuses — N.js GetBuffBonuses", () => {
  // Talent 469's y is decay(40, 100) at lv 10 = 3.6363…; talent 46's y is
  // bigBase(400, 5) = 450; talent 45's x is 165 (> 0).
  const load = (cls: number, buffs: number[]) =>
    loadSaveData({
      charNames: ["A"],
      data: { StarSg: {}, CharacterClass_0: cls, BuffsActive_0: buffs.map((b) => [b, 100, 100]), SL_0: { 45: 10, 46: 10, 469: 10 } },
    });

  it("is the talent's second bonus while its buff is active, else 0", () => {
    load(32, []);
    expect(getBuffBonuses(469, 2, 0, saveData)).toBe(0);
    load(32, [469]);
    expect(getBuffBonuses(469, 2, 0, saveData)).toBeCloseTo(40 * 10 / 110, 12);
  });

  it("Void Radius (46) also needs class 4 or 5 and an active buff 45", () => {
    load(4, [46]);
    expect(getBuffBonuses(46, 2, 0, saveData)).toBe(0);
    load(7, [45, 46]);
    expect(getBuffBonuses(46, 2, 0, saveData)).toBe(0);
    load(4, [45, 46]);
    expect(getBuffBonuses(46, 2, 0, saveData)).toBe(450);
  });

  it("buff 615 reads 1", () => {
    load(1, [615]);
    expect(getBuffBonuses(615, 1, 0, saveData)).toBe(1);
  });
});

describe("MR_MASSACRE gate (AlchBubbles.MKtierACTIVE)", () => {
  const lv = Array(16).fill(0);
  lv[15] = 100; // CauldronInfo[3][15]: MR_MASSACRE
  const bubble = (equipped: string[]) => {
    const t = computeArkhMultikill(
      { charNames: ["A"], data: { StarSg: {}, CauldronInfo: [[], [], [], lv], CauldronBubbles: [equipped] } },
      0,
      14
    ).tree;
    return Number(t.children![2].children![MK_POOLS.perTier.indexOf("bubbleMKtier")].val);
  };

  it('needs "c15" equipped without Sheepie (cauldron letters _ a b c)', () => {
    expect(bubble(["c15"])).toBeGreaterThan(0);
    expect(bubble(["d15"])).toBe(0);
    expect(bubble([])).toBe(0);
  });
});
