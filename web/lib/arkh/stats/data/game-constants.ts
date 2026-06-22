// ===== GAME LOGIC CONSTANTS =====
// 1:1 port of corgan-source/js/stats/data/game-constants.js.
// Values hardcoded in game function bodies (N.js), NOT in data tables.

export const OWL_BASE: readonly number[] = [5, 10, 2, 4, 1, 2];

export const DIVINITY_MINOR_DENOM = 60;

export const ARCANE_NO_MULTI = new Set<number>([
  3, 7, 8, 10, 13, 16, 20, 25, 26, 28, 33, 35, 39, 40, 43, 45, 48, 57, 58,
]);

export const GRIMOIRE_NO_MULTI = new Set<number>([
  9, 11, 17, 26, 32, 36, 39, 45,
]);

export const VAULT_NO_MASTERY = new Set<number>([
  32, 1, 6, 7, 8, 9, 13, 999, 33, 36, 40, 42, 43, 44, 49, 51, 52, 53, 57, 61,
  89, 64, 70, 73, 74, 76, 79, 85, 86, 88,
]);

export type TomeData = {
  unlockType: "always" | "ola" | "eventShop";
  unlockIdx: number;
  threshold: number;
  divisor: number;
  base: number;
  exp: number;
};

export const TOME_DATA: Record<number, TomeData> = {
  0: { unlockType: "always", unlockIdx: 0, threshold: 0, divisor: 100, base: 10, exp: 0.7 },
  1: { unlockType: "ola", unlockIdx: 196, threshold: 4000, divisor: 100, base: 4, exp: 0.7 },
  2: { unlockType: "ola", unlockIdx: 197, threshold: 8000, divisor: 100, base: 2, exp: 0.7 },
  6: { unlockType: "eventShop", unlockIdx: 0, threshold: 0, divisor: 1000, base: 4, exp: 0.4 },
  7: { unlockType: "eventShop", unlockIdx: 27, threshold: 0, divisor: 1000, base: 3, exp: 0.3 },
};

export const HOLE_MULTIPLIERS: Record<string, { buildIdx: number; dataIdx: number; multi: number }> = {
  upg46: { buildIdx: 46, dataIdx: 26, multi: 5 },
  upg82: { buildIdx: 82, dataIdx: 55, multi: 20 },
  brass20: { buildIdx: 20, dataIdx: 14, multi: 5 },
};

export const COMPANION_BONUS: Record<number, number> = {
  0: 15,
  27: 2,
  30: 2,
  88: 50,
  153: 20,
};

export const BOSS3B_CARD_PCT = 5;
export const GALLERY_TROPH_CHIP_MULTI = 10;

// FriendBonusQTY (N.js, "Summer Event" 2026-06-21): the saturation curve was
// reworked when the Friend Bonus max was raised past Lv 12000. Verified
// term-by-term against N.js:
//   scale · Math.min(1.5, .25 + min(3E4,count)/(min(3E4,count)+12E3) · 1.5)
// vs the old  scale · min(1, .2 + min(12E3,count)/(count+3E3)).
// Net effect: low scores give slightly less, high scores (>12k) give more —
// DR friend bonus now tops out at ~33% (count 30k) instead of 25%.
export const FRIEND_DR = {
  scale: 25,
  base: 0.25,
  half: 12000,
  cap: 30000,
  satCap: 1.5,
  mult: 1.5,
};

export const DR_DREAM_COEFF = 5;
