// ===== JELLY OPERATOR DATA (W7, 2026-09-18) =====
// The Jelly Operator research game (unlocked via Research Grid H3): each of
// the 72 "obstructions" you defeat unlocks a permanent bonus.
//   Research[45][b] = obstruction name, Research[46][b] = effect text,
//   Research[47][b] = bonus value. The save keeps the defeated count in
//   Research[7][9] (loaded as saveData.stateR7).
// N.js _customBlock_JellyOperation("RoG_BonusQTY", b, e):
//   Research[7][9] > b || e == 99 ? CustomLists.Research[47][b] : 0
// i.e. obstruction b (0-based) is active once MORE than b have been defeated.
import { Research } from "../game/customlists.js";
import type { SaveData } from "../../../state";

const _research = Research as any[];

export const JELLY_ROG_NAMES: string[] = ((_research[45] as string[]) || []).map((s) =>
  String(s).replace(/_/g, " ")
);
export const JELLY_ROG_DESC: string[] = ((_research[46] as string[]) || []).map((s) =>
  String(s).replace(/_/g, " ")
);
export const JELLY_ROG_QTY: number[] = ((_research[47] as string[]) || []).map(Number);

/** Successful Jelly Operations (obstructions defeated) = Research[7][9]. */
export function jellyOperations(saveData: SaveData): number {
  return Number((saveData.stateR7 as any)?.[9]) || 0;
}

// @njs _customBlock_JellyOperation
// @njs RoG_BonusQTY
/** JellyOperation("RoG_BonusQTY", idx, 0) — the obstruction's bonus value once
 *  it has been defeated (defeated count > idx), else 0. */
export function jellyRoGBonus(idx: number, saveData: SaveData): number {
  return jellyOperations(saveData) > idx ? JELLY_ROG_QTY[idx] || 0 : 0;
}

/** "}x_Drop_Rate" → "Drop Rate" for labels. */
export function jellyEffectText(idx: number): string {
  return (JELLY_ROG_DESC[idx] || "")
    .replace(/[{}|]/g, "")
    .replace(/^\s*x\s*/, "")
    .replace(/^\s*[+%]+\s*/, "")
    .replace(/\s+@.*$/, "")
    .trim();
}

/** "Gold Bangle (Jelly Obstruction 15) — Drop Rate (Jelly Bonus 14)". */
export function jellyLabel(idx: number): string {
  const name = JELLY_ROG_NAMES[idx] || `Obstruction ${idx + 1}`;
  const effect = jellyEffectText(idx);
  const prefix = `${name} (Jelly Obstruction ${idx + 1})`;
  return effect ? `${prefix} — ${effect} (Jelly Bonus ${idx})` : `${prefix} (Jelly Bonus ${idx})`;
}
