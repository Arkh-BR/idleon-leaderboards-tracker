// ===== FARMING STICKERS (W7 Research) =====
// @njs StickerBonus — N.js FarmingStuffs("StickerBonus",b,0) (@10742976):
//   (1 + (Grid_Bonus(68,2) + 30·EventShopOwned(37))/100) · (1 + 20·SuperBitType(62)/100)
//   · Research[9][b] · CustomLists.Research[25][b]
// Research[9] = stickers found per type. Grid_Bonus(68,2) (@11085384, the
// b∈{67,68,107} arm) = Grid_Bonus(68,0) · Research[11].length — Boony Crowns'
// per-crown % times the King Rat crowns reclaimed.
import { Research } from "../../data/game/customlists.js";
import { eventShopOwned, superBitType } from "../../../game-helpers";
import { menagerieUnlockOwned } from "../../data/w7/menagerie";
import { gridBonusValue } from "../w4/lab";
import type { SaveData } from "../../../state";

export function stickerCount(idx: number, s: SaveData): number {
  return Number((s.research as any)?.[9]?.[idx]) || 0;
}

/** Grid_Bonus(68,2): Research[11] also deserializes as a {…, length} object. */
export function stickerCrownPct(s: SaveData): number {
  return gridBonusValue(68, s) * (Number((s.research as any)?.[11]?.length) || 0);
}

export function stickerBonus(idx: number, s: SaveData): number {
  const multi =
    (1 + (stickerCrownPct(s) + 30 * eventShopOwned(37, s.cachedEventShopStr)) / 100) *
    (1 + (20 * superBitType(62, (s.gamingData as any)?.[12])) / 100);
  return multi * stickerCount(idx, s) * (Number((Research as any)[25]?.[idx]) || 0);
}

/** The same N.js StickerBonus call with its slot argument (e = 99 or 100):
 *  stickers 1 and 2 count only in one slot, picked by Menagerie unlock 22 —
 *  slot 99 while it is locked, slot 100 once it is bought (the other reads 0). */
// @njs StickerBonus
export function stickerBonusSlot(idx: number, slot: 99 | 100, s: SaveData): number {
  const owned = menagerieUnlockOwned(22, s);
  if ((idx === 1 || idx === 2) && ((slot === 99 && owned === 1) || (slot === 100 && owned === 0))) return 0;
  return stickerBonus(idx, s);
}
