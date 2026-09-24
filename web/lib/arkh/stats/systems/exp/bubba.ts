// ===== BUBBA RoG BONUSES (W7 Bubba) =====
// N.js _customBlock_Bubbastuff, "BubbaRoG_Bonuses" branch (@11070990):
//   all = 20·(MF(1) + MF(3) + MF(6) + MF(9) + MF(11))
//   max(0, (1 + all/100) · (1 + Companions(51)) · Spelunky[33][b]
//          · ceil((Bubba[1][3] − (b−1)) / 7))
// MegafleshOwned(k) (same function, right after):
//   Bubba[1][8] > k ? (k == 11 ? Bubba[1][8] − 11 : 1) : 0
// Bubba is the save's "Bubba" list (N.js load @19722843; loader bubbaData).
import { Spelunky } from "../../data/game/customlists.js";
import { companions } from "../common/companions";
import type { SaveData } from "../../../state";

const bubba1 = (i: number, s: SaveData): number => Number((s.bubbaData as any)?.[1]?.[i]) || 0;

export function megafleshOwned(k: number, s: SaveData): number {
  const mf = bubba1(8, s);
  return mf > k ? (k === 11 ? mf - 11 : 1) : 0;
}

/** Bubba_RoG_all: +20% per megaflesh milestone (1/3/6/9, then each past 11). */
export function bubbaRoGAll(s: SaveData): number {
  return 20 * (megafleshOwned(1, s) + megafleshOwned(3, s) + megafleshOwned(6, s) + megafleshOwned(9, s) + megafleshOwned(11, s));
}

/** ceil((Bubba[1][3] − (b−1)) / 7) — the RoG slot's tier count. */
export function bubbaRoGTiers(idx: number, s: SaveData): number {
  return Math.ceil((bubba1(3, s) - (idx - 1)) / 7);
}

export function bubbaRoGBonus(idx: number, s: SaveData): number {
  const base = Number((Spelunky as any)[33]?.[Math.round(idx)]) || 0;
  return Math.max(0, (1 + bubbaRoGAll(s) / 100) * (1 + companions(51, s)) * base * bubbaRoGTiers(idx, s));
}
