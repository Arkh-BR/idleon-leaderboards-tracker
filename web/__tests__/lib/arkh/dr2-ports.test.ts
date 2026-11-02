// Drop Rate V2 engine ports: the Crystal Glunko Cove DR (N.js Holes2 "Cglunko_DR")
// and the DR reference-map choice. Expected numbers are hand-computed from the
// N.js expression, not from the port.
import { describe, it, expect } from "vitest";
import { saveData, type SaveData } from "@/lib/arkh/state";
import { assignSaveData } from "@/lib/arkh/save/data";
import { RandoListo2 } from "@/lib/arkh/stats/data/game/customlists.js";
import { cglunkoDR, cglunkoUpgBon, coveActive } from "@/lib/arkh/stats/systems/dr2/cove";
import { bestDrMapIdx } from "@/lib/arkh/stats/systems/dr2/maps";
import { isFightingMap } from "@/lib/arkh/stats/data/common/maps";
import { FORMULA_REGISTRY } from "../../../scripts/updater/registry/formula-registry.gen";

const sd = (o: Record<string, unknown> = {}) => ({ ...saveData, ...o }) as SaveData;
/** A save plus OptionsListAccount (a main-thread global, set through assignSaveData). */
const sdOla = (ola: Record<number, number>, o: Record<string, unknown> = {}) => {
  const arr: number[] = [];
  for (const [k, v] of Object.entries(ola)) arr[Number(k)] = v;
  assignSaveData({ optionsListData: arr });
  return sd(o);
};
/** RandoListo2[13][i] — the per-level value of Cove upgrade i. */
const per = (i: number) => Number((RandoListo2 as any)[13][i]);

describe("coveActive", () => {
  const s = sd({ holesData: [[17, 3]] });
  it("is true only on map 216 with the character in cavern 17", () => {
    expect(coveActive(s, 0, 216)).toBe(true);
    expect(coveActive(s, 1, 216)).toBe(false); // cavern 3
    expect(coveActive(s, 0, 215)).toBe(false);
    expect(coveActive(s, 5, 216)).toBe(false); // no such character
    expect(coveActive(sd(), 0, 216)).toBe(false); // no Holes in the save
  });
});

describe("cglunkoUpgBon", () => {
  it("is OLA[630+i] x RandoListo2[13][i]", () => {
    const s = sdOla({ 638: 58, 643: 33 });
    expect(cglunkoUpgBon(8, s)).toBe(58 * 1);
    expect(cglunkoUpgBon(13, s)).toBe(33 * 3);
    expect(cglunkoUpgBon(1, s)).toBe(0);
  });
});

describe("cglunkoDR", () => {
  it("is 1 with every upgrade at 0 (even with kills recorded)", () => {
    expect(cglunkoDR(sdOla({}))).toBe(1);
    expect(cglunkoDR(sdOla({ 654: 1e6, 660: 1e6, 668: 1e9, 200: 1e12 }))).toBe(1);
  });

  it("adds upgrades 1, 17 and 21 inside one (1 + sum/100)", () => {
    const s = sdOla({ 631: 10, 647: 4, 651: 2 }); // 10x15 + 4x25 + 2x150 = 550
    expect(cglunkoDR(s)).toBeCloseTo(1 + (10 * per(1) + 4 * per(17) + 2 * per(21)) / 100, 12);
    expect(cglunkoDR(s)).toBeCloseTo(6.5, 12);
  });

  it("multiplies upgrade 3 and upgrade 12 as separate (1 + x/100) factors", () => {
    expect(cglunkoDR(sdOla({ 633: 2 }))).toBeCloseTo(1 + (2 * 8) / 100, 12); // 1.16
    expect(cglunkoDR(sdOla({ 642: 4 }))).toBeCloseTo(1 + (4 * 25) / 100, 12); // 2
    expect(cglunkoDR(sdOla({ 633: 2, 642: 4 }))).toBeCloseTo(1.16 * 2, 12);
  });

  it("scales upgrade 10 by the digits of the six blue-shape counters (OLA 654-659)", () => {
    // ceil(log10): 500 -> 3, 50 -> 2, 1 -> 0, 0 -> 0  =>  Bdig = 5
    const s = sdOla({ 640: 3, 654: 500, 655: 50, 656: 1, 657: 0 });
    expect(cglunkoDR(s)).toBeCloseTo(1 + (3 * per(10) * 5) / 100, 12); // 1.15
    // all six counters count: 1e5 -> 5 in the last slot
    expect(cglunkoDR(sdOla({ 640: 1, 659: 1e5 }))).toBeCloseTo(1 + (1 * per(10) * 5) / 100, 12);
  });

  it("scales upgrade 22 by the digits of the six purple-shape counters (OLA 660-665)", () => {
    const s = sdOla({ 652: 5, 660: 5000, 665: 11 }); // Pdig = 4 + 2
    expect(cglunkoDR(s)).toBeCloseTo(1 + (5 * per(22) * 6) / 100, 12); // 1.6
  });

  it("scales upgrade 4 by ceil(log10 OLA[668]) and upgrade 18 by ceil(log10 OLA[200])", () => {
    expect(cglunkoDR(sdOla({ 634: 3, 668: 2500 }))).toBeCloseTo(1 + (3 * per(4) * 4) / 100, 12); // 1.36
    expect(cglunkoDR(sdOla({ 648: 6, 200: 2e7 }))).toBeCloseTo(1 + (6 * per(18) * 8) / 100, 12); // 1 + 96/100
  });

  it("uses the game's truncated ln10 (2.30259): a power of ten plus one stays on its own digit", () => {
    // Math.log(1e7 + 1)/2.30259 = 6.99998: ceil = 7 (an exact log10 would give 8).
    expect(cglunkoDR(sdOla({ 648: 1, 200: 1e7 + 1 }))).toBeCloseTo(1 + (per(18) * 7) / 100, 12);
    expect(cglunkoDR(sdOla({ 634: 1, 668: 1000 }))).toBeCloseTo(1 + (per(4) * 3) / 100, 12);
  });

  it("is the product of every factor when all of them are set", () => {
    const s = sdOla({
      631: 10, 647: 4, 651: 2, // 1 + 550/100
      633: 2, // upg 3
      642: 4, // upg 12
      640: 3, 654: 500, 655: 50, // upg 10 x Bdig 5
      652: 5, 660: 5000, 665: 11, // upg 22 x Pdig 6
      634: 3, 668: 2500, // upg 4 x 4
      648: 6, 200: 2e7, // upg 18 x 8
    });
    const expected = 6.5 * 1.16 * 2 * 1.15 * 1.6 * 1.36 * 1.96;
    expect(cglunkoDR(s)).toBeCloseTo(expected, 10);
  });
});

describe("bestDrMapIdx", () => {
  const MAPS = 327;
  const arc = Array(59).fill(0);
  arc[58] = 10; // Arcane 58: lifts the arcane map bonus cap to 10
  const env = (kills: Record<number, [number, number, number]>, extra: Record<string, unknown> = {}) => {
    const mapBon = Array.from({ length: MAPS }, (_, m) => kills[m] ?? [0, 0, 0]);
    return { charNames: ["A"], data: { Arcane: arc, MapBon: mapBon, CurrentMap_0: 14, ...extra } };
  };

  it("picks the fighting map with the most slot-0 arcane kills", () => {
    // 14 = Valley of the Beans, 30 and 1 are fighting maps too
    expect(bestDrMapIdx(env({ 14: [1e3, 0, 0], 30: [1e4, 0, 0], 1: [1e2, 0, 0] }), 0)).toBe(30);
  });

  it("looks at slot 0 only (slots 1 and 2 are the EXP and AFK bonuses)", () => {
    expect(bestDrMapIdx(env({ 14: [1e3, 0, 0], 30: [0, 1e4, 1e4] }), 0)).toBe(14);
  });

  it("never returns the Cove (216), however many kills it has", () => {
    expect(bestDrMapIdx(env({ 216: [1e4, 0, 0], 14: [1e3, 0, 0] }), 0)).toBe(14);
  });

  it("breaks ties toward the lowest map index", () => {
    expect(bestDrMapIdx(env({ 30: [1e4, 0, 0], 14: [1e4, 0, 0] }), 0)).toBe(14);
  });

  it("with no slot-0 kills falls back to the character's own fighting map, else the lowest one", () => {
    expect(bestDrMapIdx(env({}), 0)).toBe(14);
    expect(bestDrMapIdx(env({}, { CurrentMap_0: 216 }), 0)).not.toBe(216);
    const town = bestDrMapIdx(env({}, { CurrentMap_0: 0 }), 0);
    expect(isFightingMap(town) && town !== 216).toBe(true);
  });
});

describe("registry", () => {
  it("lists the Cove port under N.js's Holes2 block", () => {
    expect(FORMULA_REGISTRY["_customBlock_Holes2"]).toContain("lib/arkh/stats/systems/dr2/cove.ts");
  });
});
