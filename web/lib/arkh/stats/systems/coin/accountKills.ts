// ===== ACCOUNT KILL COUNTERS (coin) =====
// Ports of N.js Summoning("VaultKillzTotal", k) and Stuff2("CardsCollected").

import { mapKillReq } from "../../data/common/maps";
import { klaData, numCharacters, cauldronInfoData } from "../../../save/data";
import { getLOG } from "../../../formulas";
import { CardStuff } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

/** N.js: MapDetails[m][0][0] − KillsLeft2Advance[m][0], summed over every player. */
export function accountMapKills(m: number): number {
  let total = 0;
  for (let ci = 0; ci < numCharacters; ci++) {
    const row = (klaData as any[])[ci]?.[m];
    if (!Array.isArray(row)) continue;
    total += mapKillReq(m) - (Number(row[0]) || 0);
  }
  return total;
}

// VaultKillzTotal order: kills on maps 14, 24, 13, 8 (0–3), ⌊log10⌋ of those
// (4–7), Tasks[3] completions (8), Σ min(100, bubble lv) (9).
const VK_MAPS = [14, 24, 13, 8] as const;

export function vaultKillzTotal(k: number, saveData: SaveData): number {
  if (k >= 0 && k <= 3) return accountMapKills(VK_MAPS[k]);
  if (k >= 4 && k <= 7) {
    const kills = accountMapKills(VK_MAPS[k - 4]);
    return kills < 10 ? 0 : Math.floor(getLOG(kills));
  }
  if (k === 8) {
    const t3 = ((saveData.tasksGlobalData as any[]) ?? [])[3] ?? [];
    let n = 0;
    for (let d = 0; d < 4; d++) for (const v of t3[d] ?? []) if (Number(v) === 1) n++;
    return n;
  }
  if (k === 9) {
    let n = 0;
    for (let c = 0; c < 4; c++) {
      // CauldronInfo[c] can be a real array or a {slot: lv, length: N} dict
      // depending on the save envelope (same quirk as CauldronInfo[4] in
      // calcTalent.ts talents 470/485) — handle both, and skip the "length"
      // key so it isn't summed in as a bogus 41st bubble.
      const cat = (cauldronInfoData as any[])[c];
      if (Array.isArray(cat)) {
        for (const lv of cat) n += Math.min(100, Number(lv) || 0);
      } else if (cat && typeof cat === "object") {
        for (const key in cat) {
          if (key === "length") continue;
          n += Math.min(100, Number(cat[key]) || 0);
        }
      }
    }
    return Math.round(n);
  }
  return 0;
}

/** N.js Stuff2("CardsCollected"): distinct CardStuff cards with Cards[0][key] ≥ 1. */
export function cardsCollected(saveData: SaveData): number {
  const owned = (saveData.cards0Data ?? {}) as Record<string, unknown>;
  let n = 0;
  for (const row of CardStuff as unknown as unknown[][]) {
    for (const card of row ?? []) {
      const key = String((card as unknown[])?.[0] ?? "Blank");
      if (key !== "Blank" && Number(owned[key]) >= 1) n++;
    }
  }
  return n;
}
