// ===== GAMING PALETTE DATA =====
// 1:1 port of corgan-source/js/stats/data/w4/gaming.js.
import { GamingPalette } from "../game/customlists.js";

export type PaletteParams = { denom: number; coeff: number; isDecay: boolean };

const _GamingPalette = GamingPalette as any[];

export function paletteParams(idx: number): PaletteParams {
  const p = _GamingPalette[idx];
  if (!p) return { denom: 1, coeff: 0, isDecay: false };
  // p[4] = coefficient, p[5] = type (1=decay, 0=linear), decay denom=25
  return {
    coeff: Number(p[4]) || 0,
    denom: 25,
    isDecay: Number(p[5]) === 1,
  };
}
