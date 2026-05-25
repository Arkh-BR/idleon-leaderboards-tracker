// ===== GAMING DATA STUB (Stage 4 will port real impl) =====
// Returns zero coefficients so palette-based bonuses short-circuit.
export type PaletteParams = { denom: number; coeff: number };

export function paletteParams(_idx: number): PaletteParams {
  return { denom: 1, coeff: 0 };
}
