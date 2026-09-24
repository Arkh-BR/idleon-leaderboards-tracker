// ===== SALT LICK (W3 Refinery) =====
// N.js _customBlock_SaltLick(i) (@7774631):
//   SaltLick[i] > 0 ? SaltLick[i] · CustomLists.SaltLicks[i][3] : 0
// SaltLick is the save's per-upgrade level list (N.js load: getLoadJsonList
// ("SaltLick"), @19714362 → loader saltLickData). Generic by index: EXP reads
// 3 (Class EXP), other stats read their own row.
import { SaltLicks } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

export function saltLickLevel(idx: number, s: SaveData): number {
  return Number((s.saltLickData as any)?.[idx]) || 0;
}

export function saltLick(idx: number, s: SaveData): number {
  const lv = saltLickLevel(idx, s);
  return lv > 0 ? lv * (Number((SaltLicks as any)[idx]?.[3]) || 0) : 0;
}
