// ===== W5 DIVINITY SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/w5/divinity.js (hasBonusMajor only).
//
// hasBonusMajor(playerIdx, godType, saveData) returns true if the player has the
// "major bonus" for godType active. Sources checked in order:
//   1. Companion 0 (Ballthezar) — all gods if divinity lv >= 2
//   2. Holes PocketDiv slots [11][29] and [11][30]
//   3. W7divChosen (OptionsListAccount[425])
//   4. Research Grid 173 (Wisdom/God 2 only)
//   5. Normal assignment: divinityData[playerIdx + 12]

import { godsType } from "../../data/w4/gods";
import { divinityData, optionsListData, skillLvData } from "../../../save/data";
import type { SaveData } from "../../../state";

export function hasBonusMajor(
  playerIdx: number,
  godType: number,
  saveData: SaveData
): boolean {
  // 1. Companion 0 (Ballthezar): all gods if char 0 divinity lv >= 2
  if (
    saveData.companionIds &&
    saveData.companionIds.has(0) &&
    (((saveData as any).lv0AllData?.[0] && (saveData as any).lv0AllData[0][14]) || 0) >= 2
  ) {
    return true;
  }
  // 2. Holes PocketDiv slots
  const hd: any = saveData.holesData;
  const hole29 = hd && hd[11] && hd[11][29] != null ? hd[11][29] : -1;
  const hole30 = hd && hd[11] && hd[11][30] != null ? hd[11][30] : -1;
  if (hole29 >= 0 && godsType(hole29) === godType) return true;
  if (hole30 >= 0 && godsType(hole30) === godType) return true;
  // 3. W7divChosen
  const w7chosen = Number((optionsListData as any)?.[425]) || 0;
  if (w7chosen > 0) {
    const chosenGodIdx = Math.max(0, w7chosen - 1);
    if (chosenGodIdx >= 0 && godsType(chosenGodIdx) === godType) return true;
  }
  // 4. Research Grid 173 for type 2 (Wisdom)
  if (
    godType === 2 &&
    ((saveData.gridLevels && (saveData.gridLevels as any)[173]) || 0) >= 1
  ) {
    return true;
  }
  // 5. Normal: char's assigned god from divinityData[playerIdx + 12]
  const assignedGod = (divinityData as any)?.[playerIdx + 12];
  const gid = assignedGod == null ? -1 : assignedGod;
  if (gid >= 0 && godsType(gid) === godType) return true;
  return false;
}

/** N.js Divinity("Bonus_MAJOR", ci, type) (@10683007): hasBonusMajor plus the
 *  two paths it misses — Gem Shop item 9 (type 0 only) and Polytheism
 *  (talent 505: god SL505 mod 10, while Divinity[25] > that index, only for a
 *  character linked to a god). hasBonusMajor stays as the DR reads it. */
// @njs Bonus_MAJOR
export function bonusMajorReal(ci: number, type: number, saveData: SaveData): boolean {
  if (hasBonusMajor(ci, type, saveData)) return true;
  if (type === 0 && Number((saveData.gemItemsData as any)?.[9]) === 1) return true;
  const linked = (divinityData as any)?.[ci + 12];
  if (linked == null || Number(linked) === -1) return false;
  const sl505 = Number((skillLvData as any)?.[ci]?.[505]) || 0;
  if (!(sl505 > 0)) return false;
  const g = sl505 - 10 * Math.floor(sl505 / 10);
  return godsType(g) === type && (Number((divinityData as any)?.[25]) || 0) > g;
}
