// ===== W5 FARMING DATA STUB (Stage 3 will port real impl) =====
export type ExoticParams = { base: number; denom: number; farmSlot: number };

export function exoticParams(_idx: number): ExoticParams {
  return { base: 0, denom: 1, farmSlot: 0 };
}
