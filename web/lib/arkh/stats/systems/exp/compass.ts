// ===== COMPASS BONUS (Windwalker "CompassBonus") =====
// N.js _customBlock_Windwalker, "CompassBonus" branch (@10971766):
//   CompassUpg[b][9]==1 ? (1+(CompassBonus(39)+CompassBonus(80))/100) * Compass[0][b] * CompassUpg[b][5]
//   : b==45 ? Compass[0][b] * CompassUpg[b][5] * 2^floor(Compass[0][b]/50)
//   : Compass[0][b] * CompassUpg[b][5]
// EXP Multi only reads id 51 (Moon of Experience), whose CompassUpg[51][9]
// is the static string "0" (never the circle branch) — the port stays
// generic (idx-taking, recursive on the circle branch) to match N.js exactly
// rather than hardcoding the one branch this save happens to take.
import { compassUpgPerLevel, compassUpgIsCircle } from "../../data/common/compass";
import type { SaveData } from "../../../state";

export function compassLevel(idx: number, saveData: SaveData): number {
  const levels = (saveData.compassData as any)?.[0];
  return Number(levels?.[idx]) || 0;
}

export function compassBonus(idx: number, saveData: SaveData): number {
  const lv = compassLevel(idx, saveData);
  const perLv = compassUpgPerLevel(idx);
  if (compassUpgIsCircle(idx)) {
    const circleMulti = 1 + (compassBonus(39, saveData) + compassBonus(80, saveData)) / 100;
    return circleMulti * lv * perLv;
  }
  if (idx === 45) return lv * perLv * Math.pow(2, Math.floor(lv / 50));
  return lv * perLv;
}
