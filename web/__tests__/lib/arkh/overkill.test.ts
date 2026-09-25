// Synthetic saves for the shared damage-tier helper (spec M5). This file never
// loads a real save: the arkh state is a singleton and loadSaveData doesn't
// reset every field. The OLA array is sparse on purpose (OLA[606]).
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { multikillTier, overkillActive, overkillStuffs } from "@/lib/arkh/stats/systems/common/overkill";
import { FORMULA_REGISTRY } from "@/scripts/updater/registry/formula-registry.gen";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("multikillTier (N.js OverkillStuffs '2')", () => {
  it("tier k from HP·E^k; tier 1 below HP·E²", () => {
    expect(multikillTier(100, 399, 2)).toBe(1);
    expect(multikillTier(100, 400, 2)).toBe(2);
    expect(multikillTier(100, 799, 2)).toBe(2);
    expect(multikillTier(100, 800, 2)).toBe(3);
    expect(multikillTier(10, 10 * 5 ** 7 - 1, 5)).toBe(6);
    expect(multikillTier(10, 10 * 5 ** 7, 5)).toBe(7);
  });

  it("caps at 51 and reads 1 without a target HP", () => {
    expect(multikillTier(1, 1e300, 2)).toBe(51);
    expect(multikillTier(0, 1e30, 2)).toBe(1);
  });
});

describe("overkillStuffs — the AFK target's live HP", () => {
  const ola: number[] = [];
  ola[464] = 8;
  const owned = Array(20).fill(0);
  owned[8] = 50; // Jawbreaker lv 50: round(200 × 5.9) = 1180%
  const load = (prayers: number[]) =>
    loadSaveData({
      charNames: ["A"],
      data: { StarSg: {}, OptLacc: ola, PrayOwned: owned, Prayers_0: prayers, CurrentMap_0: 14 },
    });

  it("an equipped curse multiplies the HP: Jawbreaker lv 50 → ×12.8 (E = 5 in W7)", () => {
    load([8, -1, -1, -1, -1, -1]);
    const ok = overkillStuffs(0, 301, { saveData });
    expect(ok).toMatchObject({ target: "w7a1", clam: false, staticHp: 7e13, exponent: 5 });
    expect(ok.curses).toEqual([0, 0, 1180]);
    expect(ok.curse).toBeCloseTo(12.8, 12);
    expect(ok.hp / (7e13 * 12.8)).toBeCloseTo(1, 12);
  });

  it("uses a max damage the caller already has (Coin's talent 643 passes its own)", () => {
    load([8, -1, -1, -1, -1, -1]);
    const hp = overkillStuffs(0, 301, { saveData }).hp;
    const ok = overkillStuffs(0, 301, { saveData }, { maxDmg: hp * 200 }); // HP·5³ ≤ 200·HP < HP·5⁴
    expect(ok.maxDmg).toBe(hp * 200);
    expect(ok.tier).toBe(3);
  });

  it("Clamworks (w7a6) is Clamz_HP = 1e16·30^OLA[464], never cursed", () => {
    load([8, -1, -1, -1, -1, -1]);
    const ok = overkillStuffs(0, 306, { saveData });
    expect(ok).toMatchObject({ target: "w7a6", clam: true, curse: 1 });
    expect(ok.hp).toBe(1e16 * Math.pow(30, 8)); // 6.561e27, not the table's 1e18
  });

  it("the saved map measures against AFKtarget_N, other maps against MapAFKtarget (spec M1)", () => {
    load([-1, -1, -1, -1, -1, -1]);
    expect(overkillStuffs(0, 14, { saveData, afkTarget: "w6a1" }).target).toBe("w6a1");
    expect(overkillStuffs(0, 1, { saveData, afkTarget: "w6a1" }).target).toBe("mushG");
    expect(overkillStuffs(0, 14, { saveData }).target).toBe("beanG");
  });

  it("OverkillStuffs('3') needs the Death Note built (TowerInfo[2] > 0.5)", () => {
    load([-1, -1, -1, -1, -1, -1]);
    expect(overkillActive(overkillStuffs(0, 14, { saveData }), 0, saveData)).toMatchObject({
      deathNote: false,
      active: false,
    });
  });

  it("registers the port under N.js's names for the updater", () => {
    expect(FORMULA_REGISTRY["OverkillStuffs"]).toEqual(["lib/arkh/stats/systems/common/overkill.ts"]);
    expect(FORMULA_REGISTRY["Clamz_HP"]).toEqual(["lib/arkh/stats/systems/common/overkill.ts"]);
  });
});
