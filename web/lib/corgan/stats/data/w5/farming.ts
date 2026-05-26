// ===== W5 FARMING DATA =====
// Real port replacing Stage 2 stub. Uses MarketExoticInfo and NinjaInfo
// from game-data; exoticParams reads the per-idx exotic data, ninjaInfo
// reads NinjaInfo[idx] for rank/upgrade tables.
import { MarketExoticInfo, NinjaInfo } from "../game/customlists.js";

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

export function ninjaInfo(idx: number): any[] {
  const arr = (NinjaInfo as any)[idx];
  return Array.isArray(arr) ? arr : [];
}
