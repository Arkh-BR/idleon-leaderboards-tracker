import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { divinityData, optionsListData } from "@/lib/arkh/save/data";
import { N2L } from "@/lib/game/data/generated/hardcoded.js";
import { DeathNoteMobs, GodsInfo, MapAFKtarget, MapDetails } from "@/lib/game/data/generated/customlists.js";
import { damage } from "@/lib/arkh/stats/systems/damage/damage";
import { computeAccuracy } from "@/lib/arkh/stats/systems/common/derived-damage";
import { flurboShop } from "@/lib/arkh/stats/systems/coin/flurbo";
import { rooBonus } from "@/lib/arkh/stats/systems/coin/coin";
import { gridBonusValue } from "@/lib/arkh/stats/systems/w4/lab";
import { divinityBlessBonus } from "@/lib/arkh/stats/systems/w5/divinity";
import { eclipseSkulls, killroyDmg } from "@/lib/arkh/stats/systems/w4/rift";
import { stickerDmgMulti } from "@/lib/arkh/stats/systems/w6/farming";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Task 4: the four N.js reads no port covered. Each expectation is the N.js
// expression rebuilt here from the raw save keys (save.data.*), not the port.
const DIR = "scripts/updater/golden/.cache/";
const ARKHE = DIR + "arkhe-live-2026-11-01-postupdate.json";
const OCELOT = DIR + "0celot8.json";
const read = (f: string) => JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
const rawKey = (save: any, k: string) => {
  const v = save.data[k];
  return typeof v === "string" ? JSON.parse(v) : v;
};
const ctxOf = (ci: number) => ({ saveData, charIdx: ci, activeCharIdx: ci });
const val = (id: string, ci: number) => damage.resolve(id, ctxOf(ci)).val;
const s = () => saveData as any;

/** N.js Divinity("BlesssBonus", b), b ≠ 2: Divinity[28 + b] · GodsInfo[b][14]
 *  · (1 + .05 · EmporiumBonus(33) · max(0, Divinity[25] − 10)). */
const blessByHand = (save: any, b: number) => {
  const div = rawKey(save, "Divinity");
  const emp33 = String(rawKey(save, "Ninja")[102][9]).includes(N2L[33]) ? 1 : 0;
  return Number(div[28 + b]) * Number((GodsInfo as any)[b][14]) * (1 + 0.05 * emp33 * Math.max(0, Number(div[25]) - 10));
};
/** N.js RiftStuff("eclipseSkulls"): 5 per World 1–6 Death Note mob whose
 *  account kills (Σ MapDetails[m][0][0] − KLA_i[m][0]) rank ≥ 15, i.e. rank 20:
 *  kills > 1e9 with RiftStuff("riftBonus", 3) (Rift[0] ≥ 20). */
const eclipseByHand = (save: any) => {
  const rift0 = Number(rawKey(save, "Rift")[0]);
  const kla = (save.charNames as string[]).map((_, i) => rawKey(save, "KLA_" + i));
  let n = 0;
  for (let w = 0; w < 6; w++)
    for (const mob of (DeathNoteMobs as any)[w]) {
      const m = (MapAFKtarget as any).indexOf(mob);
      if (m < 0) continue;
      let kills = 0;
      for (const k of kla) kills += Number((MapDetails as any)[m][0][0]) - Number(k[m][0]);
      if (kills > 1e9 && rift0 >= 20) n++;
    }
  return 5 * n;
};
/** N.js RiftStuff("KillroyDMG"): ⌊(Σ KRbest[mob] over every DeathNoteMobs list)^0.4⌋. */
const killroyByHand = (save: any) => {
  const kr = rawKey(save, "KRbest");
  let t = 0;
  for (const list of DeathNoteMobs as any) for (const mob of list) t += Number(kr[mob]) || 0;
  return Math.floor(Math.pow(t, 0.4));
};
/** N.js FarmingStuffs("TotalStickers") = round(Σ Research[9]). */
const stickersByHand = (save: any) => {
  const r9 = rawKey(save, "Research")[9];
  let t = 0;
  for (let e = 0; e < r9.length; e++) t += Number(r9[e]);
  return Math.round(t);
};

describe.skipIf(!existsSync(ARKHE))("new damage ports — ARKHE post-update", () => {
  let save: any;
  const ci = 0;
  beforeEach(() => {
    save ??= read(ARKHE);
    loadSaveData(save);
  });

  it.each([7, 8])("Divinity BlesssBonus %i = Divinity[28+b]·GodsInfo[b][14]·(1 + .05·Emp33·max(0, Div[25] − 10))", (b) => {
    const want = blessByHand(save, b);
    expect(want).toBeGreaterThan(0);
    expect(divinityBlessBonus(b, s())).toBe(want);
    expect(val("bless" + b, ci)).toBe(want);
  });
  it("BlesssBonus is 0 for a blessing never leveled", () => {
    (divinityData as any)[35] = 0;
    expect(divinityBlessBonus(7, s())).toBe(0);
    expect(val("bless7", ci)).toBe(0);
  });

  it("eclipseSkulls = 5 per rank-20 World 1–6 Death Note mob", () => {
    const want = eclipseByHand(save);
    expect(want).toBeGreaterThan(0);
    expect(eclipseSkulls(s())).toBe(want);
    expect(val("eclipse", ci)).toBe(1 + want / 100);
  });
  it("eclipseSkulls is 0 below Rift 20 (no rank 20)", () => {
    s().riftData[0] = 19;
    expect(eclipseSkulls(s())).toBe(0);
    expect(val("eclipse", ci)).toBe(1);
  });

  it("KillroyDMG = ⌊(Σ KRbest)^0.4⌋, its factor capped at ×3", () => {
    const want = killroyByHand(save);
    expect(want).toBeGreaterThan(0);
    expect(killroyDmg(s())).toBe(want);
    expect(val("killroy", ci)).toBe(1 + Math.max(0, Math.min(2, want / 100)));
  });
  it("KillroyDMG is 0 with no Killroy record", () => {
    s().krBestData = {};
    expect(killroyDmg(s())).toBe(0);
    expect(val("killroy", ci)).toBe(1);
  });

  it("StickerDMGmulti = 1 + Grid_Bonus(47)·TotalStickers/100 once grid 47 is unlocked", () => {
    const g47 = gridBonusValue(47, s());
    expect(g47).toBeGreaterThanOrEqual(1);
    const want = 1 + (g47 * stickersByHand(save)) / 100;
    expect(want).toBeGreaterThan(1);
    expect(stickerDmgMulti(s())).toBe(want);
    expect(val("sticker", ci)).toBe(want);
  });

  it("accuracy reads FlurboShop(5)", () => {
    const up = s().dungUpgData[5];
    const lv = Number(up[5]) || 0;
    const a0 = computeAccuracy(ci, ctxOf(ci));
    const f0 = flurboShop(5, s()).val;
    up[5] = lv + 10;
    expect(flurboShop(5, s()).val).toBeGreaterThan(f0);
    expect(computeAccuracy(ci, { ...ctxOf(ci) })).toBeGreaterThan(a0);
  });

  it("accuracy reads RooBonuses(3) (coefficient 2)", () => {
    const a0 = computeAccuracy(ci, ctxOf(ci));
    const r0 = rooBonus(3, 2, s()).val;
    const resets = Number((optionsListData as any)[271]) || 0;
    (optionsListData as any)[271] = resets + 70; // 10 more Roo reset tiers
    expect(rooBonus(3, 2, s()).val).toBeGreaterThan(r0);
    expect(computeAccuracy(ci, ctxOf(ci))).toBeGreaterThan(a0);
    (optionsListData as any)[271] = resets;
  });
});

describe.skipIf(!existsSync(OCELOT))("StickerDMGmulti before grid 47 — 0celot8", () => {
  it("is 1 while Research[0][47] = 0", () => {
    const save = read(OCELOT);
    loadSaveData(save);
    expect(Number(rawKey(save, "Research")[0][47])).toBe(0);
    expect(stickersByHand(save)).toBeGreaterThan(0);
    expect(stickerDmgMulti(s())).toBe(1);
    expect(val("sticker", 0)).toBe(1);
  });
});
