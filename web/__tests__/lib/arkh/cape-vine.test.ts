// The Cape Vine (2026-11-01) and the green-sigil max-damage factor, on synthetic
// saves. Expected numbers are hand-computed from the N.js expressions
// (Gallery CapevineBonusesSystemON / CapevineBonusMulti / InitializeCapeBonuses,
// Stuff2 GoldCapeVinesOwned, TotalStats, Labb TotalGreenSigils, DamageDealed Max).
import { describe, it, expect } from "vitest";
import { saveData, type SaveData } from "@/lib/arkh/state";
import { assignSaveData } from "@/lib/arkh/save/data";
import { etcBonus } from "@/lib/arkh/stats/systems/common/etcBonus";
import { computeEquipBaseStat, computeGalleryBaseStat } from "@/lib/arkh/stats/systems/common/stats";
import {
  capevineSystemOn,
  goldCapeVinesOwned,
  capevineBonusMulti,
  capeVineBonTot,
} from "@/lib/arkh/stats/systems/w7/gallery";
import { totalGreenSigils } from "@/lib/arkh/stats/systems/w2/alchemy";
import { premhatSystemOn } from "@/lib/arkh/stats/systems/w7/gallery";
import { greenSigilDmgPct } from "@/lib/arkh/stats/systems/common/derived-damage";

// EquipmentCape18: UQ1 %_CLASS_EXP_MULTI 100, UQ2 %_DROP_RATE_MULTI 40, STR 10.
// EquipmentCape23: UQ1 %_DROP_RATE 250, STR 0.
// EquipmentCape17: UQ1 %_CLASS_EXP_MULTI 25, UQ2 %_DROP_RATE 10, STR 15.
const DR = 2; // EtcBonuses(2) = %_DROP_RATE
const DR_MULTI = 91; // EtcBonuses(91) = %_DROP_RATE_MULTI

/** Character 0 wears EquipmentCape18 in slot 12; map 100's kills left = kla100
 *  (map 50, the Hat Rack's switch, is cleared as on every real save). */
function setup(kla100: number | null, ola669 = 0) {
  const kla: any[] = [];
  kla[50] = [0, 0, 0];
  if (kla100 !== null) kla[100] = [kla100, 0];
  const ola: number[] = [];
  ola[669] = ola669;
  assignSaveData({
    klaData: [kla],
    equipOrderData: [[{ 12: "EquipmentCape18" }, {}]],
    emmData: [[{}, {}]],
    optionsListData: ola,
    labData: [],
  });
}
const sd = (o: Record<string, unknown> = {}) =>
  ({ ...saveData, spelunkData: [], bundlesData: {}, companionIds: new Set<number>(), ...o }) as SaveData;
const capes = (list: string[], o: Record<string, unknown> = {}) => {
  const sp: any[] = [];
  sp[54] = list;
  return sd({ spelunkData: sp, ...o });
};
const etc = (id: number, s: SaveData) => etcBonus.resolve(id, { saveData: s, charIdx: 0 }).val;

describe("CapevineBonusesSystemON", () => {
  it("is ON when map 100 has no kills left, OFF otherwise or without KLA", () => {
    setup(0);
    expect(capevineSystemOn(0)).toBe(true);
    setup(-5);
    expect(capevineSystemOn(0)).toBe(true);
    setup(3);
    expect(capevineSystemOn(0)).toBe(false);
    setup(null);
    expect(capevineSystemOn(0)).toBe(false);
  });
});

describe("the worn cape (slot 12)", () => {
  it("system OFF: counts as before, no vine bonus", () => {
    setup(1);
    const s = capes(["EquipmentCape23"]);
    expect(etc(DR_MULTI, s)).toBe(40);
    expect(etc(DR, s)).toBe(0);
    expect(computeEquipBaseStat(0, "STR", s).val).toBe(10);
  });

  it("system ON with nothing deposited: no longer counts", () => {
    setup(0);
    const s = sd();
    expect(etc(DR_MULTI, s)).toBe(0);
    expect(computeEquipBaseStat(0, "STR", s).val).toBe(0);
    expect(capeVineBonTot(s)).toEqual({});
  });
});

describe("PremHatBonusesSystemON (map 50's kills left)", () => {
  it("skips the premium hat slot (8) and adds the Hat Rack only while ON", () => {
    const hatSave = () => {
      const sp: any[] = [];
      sp[46] = ["EquipmentHats1"]; // STR 2, Hat Rack multi 1.01
      return sd({ spelunkData: sp });
    };
    const wear = (kla50: number) => {
      const kla: any[] = [];
      kla[50] = [kla50, 0, 0];
      assignSaveData({ klaData: [kla], equipOrderData: [[{ 8: "EquipmentHats1" }, {}]], emmData: [[{}, {}]] });
    };
    wear(0);
    expect(premhatSystemOn(0)).toBe(true);
    expect(computeEquipBaseStat(0, "STR", hatSave()).val).toBe(0);
    expect(computeGalleryBaseStat(0, { saveData: hatSave(), charIdx: 0 } as any, "STR").val).toBeCloseTo(2.02, 9);
    wear(4);
    expect(premhatSystemOn(0)).toBe(false);
    expect(computeEquipBaseStat(0, "STR", hatSave()).val).toBe(2);
    expect(computeGalleryBaseStat(0, { saveData: hatSave(), charIdx: 0 } as any, "STR").val).toBe(0);
  });
});

describe("CapevineBonusMulti / GoldCapeVinesOwned", () => {
  const list = ["EquipmentCape18", "EquipmentCape23", "EquipmentCape17"];

  it("one Golden Vine by default: slot 0 full, others 25%, ×(1 + (capes + Companions(105))/100)", () => {
    setup(0);
    const s = capes(list, { companionIds: new Set([105]) }); // Catherine: +10
    expect(goldCapeVinesOwned(s)).toBe(1);
    expect(capevineBonusMulti(0, s)).toBeCloseTo(1.13, 12);
    expect(capevineBonusMulti(1, s)).toBeCloseTo(0.25 * 1.13, 12);
    expect(capevineBonusMulti(999, s)).toBeCloseTo(1.13, 12);
    // %_DROP_RATE_MULTI: Cape18's 40 on the golden slot.
    expect(etc(DR_MULTI, s)).toBeCloseTo(40 * 1.13, 9);
    // %_DROP_RATE: Cape23's 250 and Cape17's 10, both on regular slots.
    expect(etc(DR, s)).toBeCloseTo((250 + 10) * 0.25 * 1.13, 9);
  });

  it("OLA[669] adds Golden Vines; the ban_o bundle adds 3", () => {
    setup(0, 1);
    expect(goldCapeVinesOwned(capes(list))).toBe(2);
    const s = capes(list);
    expect(etc(DR, s)).toBeCloseTo(250 * 1.03 + 10 * 0.25 * 1.03, 9);
    setup(0);
    const b = capes(list, { bundlesData: { ban_o: 1 } });
    expect(goldCapeVinesOwned(b)).toBe(4);
    expect(etc(DR, b)).toBeCloseTo((250 + 10) * 1.03, 9);
  });

  it("vine bonuses need the system ON for the character", () => {
    setup(2);
    expect(etc(DR, capes(list))).toBe(0);
  });
});

describe("InitializeCapeBonuses base stats (game quirk)", () => {
  it("overwrites per cape: the LAST cape's stat × its multi + the Hat Rack's stat again", () => {
    setup(0);
    const sp: any[] = [];
    sp[54] = ["EquipmentCape18", "EquipmentCape23", "EquipmentCape17"];
    sp[46] = ["EquipmentHats1"]; // STR 2; Hat Rack multi 1 + 1 hat/100
    const s = sd({ spelunkData: sp });
    const hats = 1.01 * 2;
    const last = 15 * 0.25 * 1.03; // Cape17 on a regular slot
    expect(capeVineBonTot(s).STR).toBeCloseTo(hats + last, 9); // not 10·1.03 + 15·0.2575
    // TotalStats(STR): the Hat Rack's own term + the vine's (which repeats it).
    const g = computeGalleryBaseStat(0, { saveData: s, charIdx: 0 } as any, "STR");
    expect(g.val).toBeCloseTo(hats + hats + last, 9);
  });
});

describe("green sigil max-damage factor", () => {
  const sigils = (n: number) => {
    const arr: number[] = [];
    for (let i = 0; i < 24; i++) arr[1 + 2 * i] = i < n ? 4 : 3; // level 4 = Eclectic
    return [0, 0, 0, 0, arr];
  };
  it("counts Eclectic (level >= 4) sigils", () => {
    expect(totalGreenSigils(sd({ cauldronP2WData: sigils(7) }))).toBe(7);
  });
  it("is TotalGreenSigils × Grid_Bonus(127), capped at 100%", () => {
    const grid = (lv: number) => {
      const g: number[] = [];
      g[127] = lv;
      return g;
    };
    expect(greenSigilDmgPct(sd({ cauldronP2WData: sigils(10), gridLevels: grid(0) }))).toBe(0);
    const one = greenSigilDmgPct(sd({ cauldronP2WData: sigils(1), gridLevels: grid(1) }));
    expect(one).toBeGreaterThan(0);
    expect(greenSigilDmgPct(sd({ cauldronP2WData: sigils(10), gridLevels: grid(1) }))).toBeCloseTo(10 * one, 9);
    expect(greenSigilDmgPct(sd({ cauldronP2WData: sigils(24), gridLevels: grid(50) }))).toBe(100);
  });
});
