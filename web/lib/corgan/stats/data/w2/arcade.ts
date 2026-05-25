// ===== ARCADE DATA =====
import { ArcadeShopInfo } from "../game/customlists.js";

export function arcadeShopParams(idx: number): [string, number, number] | null {
  const s = (ArcadeShopInfo as any)[idx];
  return s ? [s[3], Number(s[1]), Number(s[2])] : null;
}
