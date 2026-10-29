// ===== W5 FARMING DATA =====
// Real port replacing Stage 2 stub. Uses MarketExoticInfo and NinjaInfo
// from game-data; exoticParams reads the per-idx exotic data, ninjaInfo
// reads NinjaInfo[idx] for rank/upgrade tables.
import { MarketExoticInfo, NinjaInfo } from "../game/customlists.js";
import type { SaveData } from "../../../state";

export type ExoticParams = {
  base: number;
  denom: number;
  farmSlot: number;
};

export function exoticParams(idx: number): ExoticParams {
  // Matches corgan-source exoticParams(): base from field[3] (not field[2]),
  // farmSlot computed as idx + 20 (FarmUpg layout: bean, beans, market[0..19],
  // exoticMarket[0..N] starting at index 20), denom hardcoded to 1000 for the
  // game's diminishing-returns formula `base * lv / (1000 + lv)`.
  const ex = (MarketExoticInfo as any)[idx];
  if (!ex) return { base: 0, denom: 1000, farmSlot: idx + 20 };
  return {
    base: Number(ex[3]) || 0,
    denom: 1000,
    farmSlot: idx + 20,
  };
}

// @njs ExoticBonusQTY
/** N.js FarmingStuffs("ExoticBonusQTY", e): MarketExoticInfo[e][3] × lv,
 *  with the decay lv/(1000+lv) when MarketExoticInfo[e][4] == 1. Since the
 *  2026-10-16 Menagerie update an exotic listed in Spelunk[50] (the "Exotic
 *  Market Doublers" you placed) gives ×2, and exotic 39 is capped at 50. */
export function exoticBonusQTY(e: number, saveData: SaveData): number {
  const ex = (MarketExoticInfo as any)[e];
  if (!ex) return 0;
  const lv = Number((saveData.farmUpgData as any)?.[20 + e]) || 0;
  if (lv <= 0) return 0;
  const base = Number(ex[3]) || 0;
  let v = Number(ex[4]) === 1 ? base * (lv / (1000 + lv)) : base * lv;
  if (exoticDoubled(e, saveData)) v *= 2;
  if (e === 39) v = Math.min(50, v);
  return v;
}

/** Exotic e has a Menagerie doubler placed on it (Spelunk[50] lists them). */
export function exoticDoubled(e: number, saveData: SaveData): boolean {
  const list = (saveData.spelunkData as any)?.[50];
  return Array.isArray(list) && list.some((x: unknown) => Number(x) === e);
}

export function ninjaInfo(idx: number): any[] {
  const arr = (NinjaInfo as any)[idx];
  return Array.isArray(arr) ? arr : [];
}
