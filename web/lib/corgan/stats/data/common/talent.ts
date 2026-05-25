// ===== TALENT / CLASS DATA =====
// 1:1 port of corgan-source/js/stats/data/common/talent.js.

import {
  TalentDescriptions,
  ClassFamilyBonuses,
  ClassAccountBonus,
  ClassPromotionChoices,
  ClassNames,
} from "../game/customlists.js";

// Build CLASS_TREES from ClassPromotionChoices: each class maps to its talent
// tab chain. Walk backward (child → parent) to build inheritance.
const _parentOf: Record<number, number> = {};
for (let _ci = 0; _ci < (ClassPromotionChoices as unknown[]).length; _ci++) {
  const _ch = (ClassPromotionChoices as unknown[][])[_ci];
  if (!_ch || _ch[0] === "Na") continue;
  for (let _j = 0; _j < _ch.length; _j++) _parentOf[Number(_ch[_j])] = _ci;
}
// Journeyman(2) → Beginner(1) hidden branch
_parentOf[2] = 1;

// Detect branch basics tabs: RAGE_BASICS(6), CALM_BASICS(18), SAVVY_BASICS(30)
const _branchBasics: Record<number, number> = {};
const _branchBases = ((ClassPromotionChoices as unknown[][])[1] || []) as unknown[];
for (let _bb = 0; _bb < _branchBases.length; _bb++) {
  const _base = Number(_branchBases[_bb]);
  if (
    (ClassNames as Record<number, string>)[_base - 1] &&
    (ClassNames as Record<number, string>)[_base - 1].indexOf("BASICS") !== -1
  ) {
    _branchBasics[_base] = _base - 1;
  }
}

export const CLASS_TREES: Record<number, number[]> = {};
for (let _ti = 0; _ti < (ClassPromotionChoices as unknown[]).length; _ti++) {
  const _chain = [_ti];
  let _cur = _parentOf[_ti];
  while (_cur !== undefined) {
    _chain.unshift(_cur);
    _cur = _parentOf[_cur];
  }
  if (_chain[0] === 1 && _chain.length > 1 && _branchBasics[_chain[1]] !== undefined) {
    _chain[0] = _branchBasics[_chain[1]];
  }
  CLASS_TREES[_ti] = _chain;
}

export type TalentParams = { x1: number; x2: number; formula: string };

export function talentParams(idx: number, tab?: number): TalentParams | null {
  const t = (TalentDescriptions as any)[idx]?.[1];
  if (!t) return null;
  if (tab === 2) {
    return t[3] && t[5] && t[5] !== "_"
      ? { x1: Number(t[3]), x2: Number(t[4]), formula: t[5] }
      : null;
  }
  return { x1: Number(t[0]), x2: Number(t[1]), formula: t[2] };
}

export type FamilyBonusParams = TalentParams & { lvOffset: number };

export function familyBonusParams(idx: number): FamilyBonusParams | null {
  const cfb = (ClassFamilyBonuses as any)[idx];
  if (!cfb) return null;
  const cab = (ClassAccountBonus as any)[idx];
  const lvOffset = cab ? Number(cab[1]) || 0 : 0;
  return {
    x1: Number(cfb[1]),
    x2: Number(cfb[2]),
    formula: cfb[3],
    lvOffset,
  };
}

export const FAMILY_BONUS_33 = familyBonusParams(33);
export const TALENT_144 = talentParams(144);
