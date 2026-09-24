// ===== BUFF BONUSES =====
// N.js GetBuffBonuses(c, b) (@4257299): talent c's bonus b (1 = x, 2 = y)
// while buff c is active on the character (BuffsActive_ci, a runtime state the
// save captures), else 0; buff 615 reads 1; buff 46 (Void Radius) also needs
// class 4 or 5 and a positive GetBuffBonuses(45, 1). derived-stats.ts keeps
// its private, ungated getBuffBonus for HP/MP.

import { buffsActiveData, charClassData } from "../../../save/data";
import { talent } from "./talent";
import type { SaveData } from "../../../state";

function buffOn(c: number, ci: number): boolean {
  const list = (buffsActiveData as any[])[ci];
  if (!list || typeof list !== "object") return false;
  for (const k of Object.keys(list)) {
    if (k === "length") continue;
    if (Number(list[k]?.[0]) === c) return true;
  }
  return false;
}

// @njs _customBlock_GetBuffBonuses
export function getBuffBonuses(c: number, b: number, ci: number, s: SaveData): number {
  if (!buffOn(c, ci)) return 0;
  if (c === 615) return 1;
  if (c === 46) {
    const cls = Number((charClassData as any[])[ci]) || 0;
    if (!((cls === 4 || cls === 5) && getBuffBonuses(45, 1, ci, s) > 0)) return 0;
  }
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  return Number(talent.resolve(c, tctx, b === 2 ? { tab: 2 } : undefined).val) || 0;
}
