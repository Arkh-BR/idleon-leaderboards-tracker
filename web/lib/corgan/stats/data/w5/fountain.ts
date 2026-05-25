// ===== FOUNTAIN DATA (W5) =====
// IT-only extension — Corgan's source predates the Fountain cavern, so this
// has no corgan-source counterpart. We hand-build the `holeFountUpg` table
// (bonusPerLevel per [tier][upgradeIdx]) for the upgrades the DR pipeline
// queries, plus the helper that reads fountainUpgradeLevels + marbleize
// from the save and returns the total bonus.
//
// The save shape is:
//   holesData[31] = fountainUpgradeLevels[tier 0..2][idx 0..19] = level (cap 10)
//   holesData[32] = fountainMarbleizeLevels[tier 0..2][idx 0..19] = marble tier
//
// Formula (matches IT's getFountainBonusTotal):
//   marbleMulti = marbleTier === 0 ? 1 : 1.5 + 0.5 * marbleTier
//   bonus       = round(level * bonusPerLevel * marbleMulti)

import type { SaveData } from "../../../state";

// Subset of holeFountUpg.bonusPerLevel — keyed [tier][upgradeIdx].
// Only the upgrades read by DR/monument live here. Add more as needed.
// Source: IT website-data.json @ holeFountUpg.
const FOUNTAIN_BONUS_PER_LV: Record<number, Record<number, number>> = {
  0: {
    13: 1, // Monumental_Boost: Bravery monument bonuses ×(1 + n/100)
  },
  1: {
    13: 1, // Judicial_Boost: Justice monument bonuses ×(1 + n/100)
  },
  2: {
    13: 0, // Wisdom Monument boost — placeholder in current game data
  },
};

export function fountainBonusPerLevel(t: number, i: number): number {
  return FOUNTAIN_BONUS_PER_LV[t]?.[i] ?? 0;
}

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
