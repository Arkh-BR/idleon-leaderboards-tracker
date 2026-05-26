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
import { divinityData, optionsListData } from "../../../save/data";
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
