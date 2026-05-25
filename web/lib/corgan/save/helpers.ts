// ===== SAVE DATA HELPERS =====
// 1:1 port of corgan-source/js/save/helpers.js.

import { labData } from "./data";

export function parseSaveKey(save: Record<string, unknown>, key: string): unknown {
  const raw = save[key];
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Corgan logs a warning here; we mirror that without crashing.
      console.warn("parseSaveKey JSON error for key", key, e);
      return raw;
    }
  }
  return raw;
}

export function labJewelUnlocked(idx: number): boolean {
  return Number((labData as any)?.[14]?.[idx] || 0) === 1;
}
