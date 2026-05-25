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
  const ex = (MarketExoticInfo as any)[idx];
  if (!ex) return { base: 0, denom: 1, farmSlot: 0 };
  return {
    base: Number(ex[2]) || 0,
    denom: Number(ex[3]) || 1,
    farmSlot: Number(ex[4]) || 0,
  };
}

export function ninjaInfo(idx: number): any[] {
  const arr = (NinjaInfo as any)[idx];
  return Array.isArray(arr) ? arr : [];
}
