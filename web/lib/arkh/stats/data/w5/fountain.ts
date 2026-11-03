// ===== FOUNTAIN DATA (W5) =====
// Arkh's source predates the Fountain cavern, so this has no corgan-source
// counterpart. We hand-build the per-level bonus (HoleFountUPG[tier][idx][6])
// for the upgrades a stat reads — Drop Rate's monuments, EXP Multi, Cooking
// Mastery, Max damage — plus the helper that reads the levels and marble
// tiers from the save and returns the total bonus.
//
// The save shape is:
//   holesData[31] = upgrade levels[tier 0..2][idx 0..19] (no cap: saves hold 566+)
//   holesData[32] = marble tiers[tier 0..2][idx 0..19]
//
// Formula (N.js Holes2 "Fountain_BonTOT" / "Fountain_MarbleBon"):
//   marbleMulti = marbleTier === 0 ? 1 : 1.5 + 0.5 * marbleTier
//   bonus       = round(marbleMulti * level * HoleFountUPG[tier][idx][6])

import type { SaveData } from "../../../state";

// Subset of HoleFountUPG[tier][idx][6] (the bonus per level), keyed
// [tier][upgradeIdx]: only the upgrades a stat reads. Add more as needed.
const FOUNTAIN_BONUS_PER_LV: Record<number, Record<number, number>> = {
  0: {
    13: 1, // Monumental_Boost: Bravery monument bonuses ×(1 + n/100)
    // Class_EXP_Boost — HoleFountUPG[0][16][6] = 1. EXP Multi G7 term
    // fountain16: ×(1 + Fountain_BonTOT(0,16)/100).
    16: 1,
  },
  1: {
    13: 1, // Judicial_Boost: Justice monument bonuses ×(1 + n/100)
    // Swingy_O'_Sword — HoleFountUPG[1][16][6] = 1. Max damage's
    // ×(1 + Fountain_BonTOT(1,16)/100), after the L2 soft cap.
    16: 1,
  },
  2: {
    // Wisdom_Boost — ACTIVATED by the Green Water update (2026-06).
    // HoleFountUPG[2][13][6] = 1 (same as Bravery/Justice). The Wisdom monument
    // (MonumentROGbonuses 2,6) feeds Drop Rate, so this ×(1 + lvl·1/100)
    // multiplies our `holes monument` DR source.
    13: 1,
    // Cook_Maxxing — Green Water (2026-06). HoleFountUPG[2][17][6] = 1.
    // N.js ExpRateCook multiplies Cooking-Mastery Exp/h by
    // (1 + Fountain_BonTOT(2,17)/100); wired in cookingMastery.externalExpMulti.
    17: 1,
  },
};

export function fountainBonusPerLevel(t: number, i: number): number {
  return FOUNTAIN_BONUS_PER_LV[t]?.[i] ?? 0;
}

// @njs Fountain_BonTOT
// @njs _customBlock_Holes2
/** N.js Holes2("Fountain_BonTOT", t, i) (@11045841); the marble multiplier is
 *  Holes2("Fountain_MarbleBon", t, i), a branch of the _customBlock_Holes2 chain. */
export function fountainBonusTotal(
  saveData: SaveData,
  t: number,
  i: number
): number {
  const perLv = fountainBonusPerLevel(t, i);
  if (!perLv) return 0;
  const hd = saveData.holesData as any[];
  if (!Array.isArray(hd)) return 0;
  const levels = hd[31];
  const marble = hd[32];
  const lv = Number(levels?.[t]?.[i]) || 0;
  if (lv <= 0) return 0;
  const mt = Number(marble?.[t]?.[i]) || 0;
  const marbleMulti = mt === 0 ? 1 : 1.5 + 0.5 * mt;
  return Math.round(lv * perLv * marbleMulti);
}
