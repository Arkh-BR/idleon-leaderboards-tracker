// ===== LUMINOUS MENAGERIE DATA (W7, 2026-10-16) =====
// Save key "Menagerie" (saveData.menagerieData), 8 lists:
//   [2][b] = Unlock b bought (>= 1), [3][b] = Boost b level,
//   [5] / [7] = per-feature levels read by Clamworks / Ninja knowledge.
// N.js _customBlock_MenagerieStuff returns 0 for everything when the save
// has no Menagerie yet (`if (0 == Menagerie.length) return 0`).
import { Research } from "../game/customlists.js";
import type { SaveData } from "../../../state";

const _research = Research as any[];

/** Per-level value of Boost b (CustomLists.Research[58][b]). */
export const MENAGERIE_BOOST_PER_LV: number[] = ((_research[58] as string[]) || []).map(Number);

/** Boost b's effect text (Research[57][b], e.g. "}x_Drop_Rate" → "Drop Rate"). */
export function menagerieBoostName(b: number): string {
  return String(((_research[57] as string[]) || [])[b] || `Boost ${b}`)
    .replace(/_/g, " ")
    .replace(/[{}]/g, "")
    .replace(/^\s*x\s*/, "")
    .replace(/^\s*[+%]+\s*/, "")
    .trim();
}

/** Boost b's purchased level (Menagerie[3][b]). */
export function menagerieBoostLv(b: number, saveData: SaveData): number {
  return Number(menagerie(saveData)[3]?.[b]) || 0;
}

function menagerie(saveData: SaveData): any[] {
  return Array.isArray(saveData.menagerieData) ? saveData.menagerieData : [];
}

// @njs ObolMISCmulti
/** MenagerieStuff("ObolMISCmulti"): 1 + Menagerie[0][9]/100. TotalStats
 *  multiplies the obol sum of every stat except STR/AGI/WIS/LUK by it; the
 *  %-ETC stats (Drop Rate, …) go through calcEtcBonuses and never see it.
 *  A save without Menagerie (pre-update) reads as 1: the game initializes
 *  the lists with zeros before any formula runs. */
export function menagerieObolMiscMulti(saveData: SaveData): number {
  return 1 + (Number(menagerie(saveData)[0]?.[9]) || 0) / 100;
}

// @njs UnlockOwned
/** MenagerieStuff("UnlockOwned", b): 1 once Unlock b is bought, else 0. */
export function menagerieUnlockOwned(b: number, saveData: SaveData): number {
  const m = menagerie(saveData);
  if (m.length === 0) return 0;
  return (Number(m[2]?.[b]) || 0) >= 1 ? 1 : 0;
}

// @njs BoostQTY
/** MenagerieStuff("BoostQTY", b): Research[58][b] × Boost b level. */
export function menagerieBoostQTY(b: number, saveData: SaveData): number {
  const m = menagerie(saveData);
  if (m.length === 0) return 0;
  return (MENAGERIE_BOOST_PER_LV[b] || 0) * (Number(m[3]?.[b]) || 0);
}
