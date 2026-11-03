import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { charClassData, optionsListData } from "@/lib/arkh/save/data";
import { superBitType, emporiumBonus } from "@/lib/arkh/game-helpers";
import { RANDOlist } from "@/lib/arkh/stats/data/game/customlists.js";
import { damage, computeMaxDamage } from "@/lib/arkh/stats/systems/damage/damage";
import { computeArkhDamagePools, combineDamagePools } from "@/lib/arkh/computeDamage";
import { computeWeaponPower, foodBoostMulti, gtn, mapDamageDivisor } from "@/lib/arkh/stats/systems/common/derived-damage";
import { vault } from "@/lib/arkh/stats/systems/common/vault";
import { vaultKillzTotal } from "@/lib/arkh/stats/systems/coin/accountKills";
import { rooBonus, flurboShop } from "@/lib/arkh/stats/systems/coin/coin";
import { divinityMinorFor } from "@/lib/arkh/stats/systems/coin/divinityMinor";
import { bubbaRoGBonus } from "@/lib/arkh/stats/systems/exp/bubba";
import { compassBonus } from "@/lib/arkh/stats/systems/exp/compass";
import { msaTotalWaves } from "@/lib/arkh/stats/systems/exp/msa";
import { saltLick } from "@/lib/arkh/stats/systems/exp/saltLick";
import { totalFoodBonuses } from "@/lib/arkh/stats/systems/exp/food";
import { farm, cropSCbonMulti } from "@/lib/arkh/stats/systems/w6/farming";
import { riftSkillETC } from "@/lib/arkh/stats/systems/w4/rift";
import { owl } from "@/lib/arkh/stats/systems/w1/owl";
import { shopUpgBonus } from "@/lib/arkh/stats/systems/w7/spelunking";
import { cglunkoUpgBon } from "@/lib/arkh/stats/systems/dr2/cove";
import { fountainBonusTotal } from "@/lib/arkh/stats/data/w5/fountain";
import { armoryUpgBonus } from "@/lib/arkh/stats/data/w7/royalG";
import { bubbleValByKey } from "@/lib/arkh/stats/systems/w2/alchemy";
import { computeCardBonusByType } from "@/lib/arkh/stats/systems/common/stats";
import { etcBonus } from "@/lib/arkh/stats/systems/common/etcBonus";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Task 3: each term the damage system used to stub (or leave neutral) now
// reads the port that already lives in another system. These prove the wire
// (damage.resolve(id) = the port called directly), not the port's formula.
const DIR = "scripts/updater/golden/.cache/";
const ARKHE = DIR + "arkhe-live-2026-11-01-postupdate.json";
const OCELOT = DIR + "0celot8.json";
const read = (f: string) => JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));

const ctxOf = (ci: number, mapIdx?: number) => ({ saveData, charIdx: ci, activeCharIdx: ci, mapIdx });
const val = (id: string, ci: number, mapIdx?: number) => damage.resolve(id, ctxOf(ci, mapIdx)).val;
const ola = (i: number) => Number((optionsListData as any)[i]) || 0;
const s = () => saveData as any;

describe.skipIf(!existsSync(ARKHE))("damage terms wired to their ports — ARKHE post-update", () => {
  let save: any;
  const ci = 2; // zArkhe: Talent 123 (Mastery) leveled
  beforeEach(() => {
    save ??= read(ARKHE);
    loadSaveData(save);
  });

  const ARENA = (n: number) => {
    const reqs = (RANDOlist as any[])[53];
    let arena = 0;
    while (arena < 16 && ola(89) >= Number(reqs[arena])) arena++;
    return arena > n ? 1 : 0;
  };

  it.each<[string, () => number]>([
    ["vault20", () => vault.resolve(20, ctxOf(ci)).val * vaultKillzTotal(5, s())],
    ["vault27", () => vault.resolve(27, ctxOf(ci)).val * vaultKillzTotal(6, s())],
    ["roo4", () => rooBonus(4, 2, s()).val],
    ["bubbaRoG4", () => bubbaRoGBonus(4, s())],
    ["lankRank14", () => farm.resolve("rank14", ctxOf(ci)).val],
    ["divMinor7", () => divinityMinorFor(ci, 7, s())],
    ["riftEtc0", () => riftSkillETC(0, s())],
    ["compass48", () => compassBonus(48, s())],
    ["msa0", () => (superBitType(7, s().gamingData?.[12]) === 1 ? Math.floor(msaTotalWaves(s()) / 10) : 0)],
    ["cropSC0", () => (emporiumBonus(27, s().ninjaData?.[102]?.[9]) ? 20 * Math.round(s().farmCropCount) * cropSCbonMulti(s()) : 0)],
    ["petArena2", () => 20 * ARENA(2)],
    ["petArena15", () => 40 * ARENA(15)],
    ["saltLick9", () => saltLick(9, s())],
    ["owl2", () => owl.resolve(2, ctxOf(ci)).val],
    ["spelunkShop64", () => shopUpgBonus(64, s())],
    ["cglunko19", () => 1 + cglunkoUpgBon(19, s()) / 100],
    ["fountain16", () => 1 + fountainBonusTotal(s(), 1, 16) / 100],
    ["foodBaseDmg", () => totalFoodBonuses("BaseDmgBoosts", ci, s()) * foodBoostMulti(ci, ctxOf(ci))],
    ["talent113b", () => 0 - gtn(113, ctxOf(ci), { tab: 2 })], // 0 here: Talent 113 not leveled on any char
    ["bubbleMastery", () => bubbleValByKey("Mastery", ci, s()).val],
    ["card21", () => computeCardBonusByType(21, ci, s()).val],
    ["talent123", () => gtn(123, ctxOf(ci))],
    ["etc21", () => etcBonus.resolve("21", ctxOf(ci)).val],
  ])("%s = its port", (id, port) => {
    expect(val(id, ci)).toBe(port());
  });

  // Not neutral on this save: the wire reaches a live value.
  it.each([
    "vault20", "vault27", "roo4", "bubbaRoG4", "lankRank14", "divMinor7", "riftEtc0", "compass48", "msa0", "cropSC0",
    "petArena2", "petArena15", "saltLick9", "owl2", "spelunkShop64", "bubbleMastery", "talent123",
  ])(
    "%s is live on this save",
    (id) => expect(val(id, ci)).toBeGreaterThan(0)
  );
  it("fountain16 (Swingy O' Sword, HoleFountUPG[1][16]) is live on this save", () => {
    expect(val("fountain16", ci)).toBeGreaterThan(1);
  });

  it("Flurbo shop 0 lives in the Weapon Power (wpSquared)", () => {
    const up = s().dungUpgData[5];
    const lv = Number(up[0]) || 0;
    const wp0 = computeWeaponPower(ci, ctxOf(ci));
    const f0 = flurboShop(0, s()).val;
    up[0] = lv + 10;
    const wp1 = computeWeaponPower(ci, ctxOf(ci));
    const f1 = flurboShop(0, s()).val;
    expect(f1 - f0).toBeGreaterThan(0);
    expect(wp1 - wp0).toBeCloseTo(f1 - f0, 6);
  });

  it("ratDmg replaces Max only on map 43", () => {
    const rat = (10 + armoryUpgBonus(35, s())) * (1 + armoryUpgBonus(36, s()) / 100);
    expect(rat).toBeGreaterThan(0);
    expect(val("ratDmg", ci, 43)).toBe(rat);
    expect(val("ratDmg", ci, 251)).toBe(0);
    expect(val("ratDmg", ci)).toBe(0);
    expect(combineDamagePools(computeArkhDamagePools(save, ci, 43)).total).toBe(rat);
    expect(computeMaxDamage(ci, { saveData }, 43)).toBe(rat);
  });

  it("map306 divides only on map 306", () => {
    const m52 = Number(s().menagerieData?.[5]?.[2]) || 0;
    // This save has Menagerie[5][2] = 0, so the divisor is 100^0 = 1 even on 306
    // (Arlong's save below has 4).
    expect(val("map306", ci, 306)).toBe(1 / Math.pow(100, m52));
    expect(val("map306", ci, 251)).toBe(1);
    expect(val("map306", ci)).toBe(1);
  });

  it("reliquarium follows Quest105 in the character's inventory", () => {
    const inv = s().inventoryOrderData[ci];
    expect(Object.values(inv).includes("Quest105")).toBe(false);
    expect(val("reliquarium", ci)).toBe(0);
    inv[Object.keys(inv).find((k) => inv[k] === "Blank")!] = "Quest105";
    expect(val("reliquarium", ci)).toBe(4 / (5 + ola(473)));
  });

  it("cactolyte halves only with Cactolyte3 open, class 2 and Quest47 held", () => {
    expect(val("cactolyte", ci)).toBe(1);
    const inv = s().inventoryOrderData[ci];
    const slot = Object.keys(inv).find((k) => inv[k] === "Blank")!;
    inv[slot] = "Quest47";
    s().itemQtyData[ci][slot] = 1;
    s().questCompleteData[ci].Cactolyte3 = 0;
    expect(val("cactolyte", ci)).toBe(1); // class still ARKHE's own
    (charClassData as any)[ci] = 2;
    expect(val("cactolyte", ci)).toBe(0.5);
  });
});

describe.skipIf(!existsSync(DIR + "Arlong.json"))("map306 with Menagerie[5][2] > 0 — Arlong", () => {
  it("divides L2 by 100^Menagerie[5][2]", () => {
    loadSaveData(read(DIR + "Arlong.json"));
    const m52 = Number(s().menagerieData?.[5]?.[2]) || 0;
    expect(m52).toBeGreaterThan(0);
    expect(val("map306", 0, 306)).toBe(1 / mapDamageDivisor(306, s()));
    expect(val("map306", 0, 306)).toBeLessThan(1);
  });
});

describe.skipIf(!existsSync(OCELOT))("Base Damage food after the cap — 0celot8", () => {
  it("foodBaseDmg = Σ BaseDmgBoosts Amount × the food-boost multiplier, live", () => {
    loadSaveData(read(OCELOT));
    const ci = 0; // 0celot8 carries FoodPotOr4
    const want = totalFoodBonuses("BaseDmgBoosts", ci, s()) * foodBoostMulti(ci, ctxOf(ci));
    expect(want).toBeGreaterThan(0);
    expect(val("foodBaseDmg", ci)).toBe(want);
  });
});
