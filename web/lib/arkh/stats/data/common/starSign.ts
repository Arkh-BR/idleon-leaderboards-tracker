// ===== STAR SIGN DATA =====
import { StarSigns } from "../game/customlists.js";

export function starSignDropVal(idx: number): number {
  const m = String((StarSigns as any)[idx]?.[1] || "").match(/\+(\d+)/);
  return m ? Number(m[1]) : 0;
}
