// ===== HOLE DATA =====
import { HolesInfo, CosmoUpgrades } from "../game/customlists.js";

export function holesMeasBase(idx: number): string | undefined {
  return (HolesInfo as any)[55]?.[idx];
}
export function holesMeasType(idx: number): number {
  return Number((HolesInfo as any)[52]?.[idx]) || 0;
}
export function holesBolaiaPerLv(idx: number): number {
  return Number((HolesInfo as any)[70]?.[idx]) || 0;
}
export function holesMonBonus(idx: number): number {
  return Number((HolesInfo as any)[37]?.[idx]) || 0;
}

export const HOLES_JAR_BONUS_PER_LV: Record<number, number> = { 23: 1, 30: 1 };

export function cosmoUpgBase(tier: number, idx: number): number {
  const c = (CosmoUpgrades as any)[tier]?.[idx];
  return c ? Number(c[0]) || 0 : 0;
}
