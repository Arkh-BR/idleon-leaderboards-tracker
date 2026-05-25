// ===== MERITOC STUB (Stage 4/5 will port real impl) =====
// computeMeritocBonusz is referenced by alchemy/sigil. Returning 0 keeps
// dependent multipliers at 1.0 (no extra boost).
import type { SaveData } from "../../../state";

export function computeMeritocBonusz(_idx: number, _saveData: SaveData): number {
  return 0;
}
