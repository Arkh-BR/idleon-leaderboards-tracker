// ===== GAME MECHANIC HELPERS =====
// 1:1 port of corgan-source/js/game-helpers.js. Pure lookup functions
// (event shop, super-bits, emporium, ribbon, cloud bonus).

import { N2L } from "./stats/data/game/hardcoded.js";
import { EMPEROR_SET_BONUS_VAL } from "./stats/data/common/emperor";

export function eventShopOwned(t: number, eventShopStr: string): number {
  if (t < 0 || t >= (N2L as string).length || !eventShopStr) return 0;
  return eventShopStr.includes((N2L as string)[t]) ? 1 : 0;
}

export function buildEventShopArray(eventShopStr: string): number[] {
  const arr = new Array((N2L as string).length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = eventShopStr && eventShopStr.includes((N2L as string)[i]) ? 1 : 0;
  }
  return arr;
}

export function superBitType(t: number, gamingData12: unknown): number {
  if (t < 0 || t >= (N2L as string).length) return 0;
  return String(gamingData12 || "").includes((N2L as string)[t]) ? 1 : 0;
}

export function buildSuperBitArray(gamingData12: unknown): number[] {
  const s = String(gamingData12 || "");
  const arr = new Array((N2L as string).length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = s.includes((N2L as string)[i]) ? 1 : 0;
  }
  return arr;
}

export function emporiumBonus(t: number, ninjaData102_9: unknown): number {
  if (t < 0 || t >= (N2L as string).length) return 0;
  return String(ninjaData102_9 || "").includes((N2L as string)[t]) ? 1 : 0;
}

export function buildEmporiumArray(ninjaData102_9: unknown): number[] {
  const s = String(ninjaData102_9 || "");
  const arr = new Array((N2L as string).length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = s.includes((N2L as string)[i]) ? 1 : 0;
  }
  return arr;
}

// N.js RibbonBonus(t): 1 + (floor(5t + floor(t/2)·(4 + 6.5·floor(t/5)))
//   + floor(t/4)·EMPEROR_SET/4 + floor(t/10)·CloudBonus(73)
//   + floor(t/20)·JellyOperation("RoG_BonusQTY",60)) / 100
// `jelly60` = the Jelly Operator obstruction-60 value (Soldier Shiv, +5 for
// tier-20+ ribbons, 2026-09-18); callers pass jellyRoGBonus(60, saveData).
export function ribbonBonusAt(
  index: number,
  ribbonData: any[],
  olaStr379: unknown,
  weeklyBossData: any,
  jelly60: number = 0
): number {
  const t = Number(ribbonData[index]) || 0;
  if (t <= 0) return 1;
  const hasEmperorSet = String(olaStr379 || "").includes("EMPEROR_SET");
  const empTerm = hasEmperorSet
    ? Math.floor(t / 4) * ((EMPEROR_SET_BONUS_VAL as number) / 4)
    : 0;
  const cb73 = weeklyBossData
    ? Math.floor(t / 10) * cloudBonus(73, weeklyBossData)
    : 0;
  const jellyTerm = Math.floor(t / 20) * (Number(jelly60) || 0);
  return (
    1 +
    (Math.floor(5 * t + Math.floor(t / 2) * (4 + 6.5 * Math.floor(t / 5))) +
      empTerm +
      cb73 +
      jellyTerm) /
      100
  );
}

// CloudBonus(n): 1 if dream challenge n is completed, 0 otherwise.
// Game: -1 == WeeklyBoss.h["d_" + n] ? 1 : 0
export function cloudBonus(n: number, weeklyBossData: any): number {
  return Number(weeklyBossData && weeklyBossData["d_" + n]) === -1 ? 1 : 0;
}
