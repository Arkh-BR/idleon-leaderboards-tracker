// ===== COOKING MASTERY — progression & Exp/h (Rift 61) =====
// Faithful port of the N.js `_customBlock_Summoning2` cooking-mastery keys
// (ExpRateCook, BonusAmountcook, ExpReqCook, RankREQcook, PtsLeftCook_*).
// Literal source snippets + index map: web/lib/cookingMastery/MECHANICS.md.
//
// Save shape — CookMaster (2D): [0][g]=Yellow PTS per meal, [1]=mastery state
// ([0]=rank, [1]=exp, [3]=ladles), [2][b]=Purple PTS per upgrade b (0..5).
// Exp/h is MULTIPLICATIVE across the upgrades; Yellow PTS do NOT feed Exp/h.

import type { SaveData } from "../../../state";
import { gridBonusValue } from "../w4/lab";
import { arcadeBonus } from "../w2/arcade";
import { computeVialByKey } from "../w2/alchemy";
import { SaltLicks } from "../../data/game/customlists";

// RandoListo2[8] — base coefficient per upgrade b (0..5).
export const MASTERY_COEF = [200, 1, 30, 10, 2, 20] as const;
// RankREQcook — mastery rank needed to unlock upgrade b.
export const MASTERY_RANK_REQ = [0, 1, 5, 10, 25, 100] as const;
// Upgrade ids that feed Exp/h. b=3 ("daily Ribbon gains") is excluded by the game.
export const EXP_UPGRADE_IDS = [0, 1, 2, 4, 5] as const;

// Display names (game strings "EXP_boost_via_…"); index = upgrade id.
export const UPGRADE_NAMES = [
  "EXP boost via Ladle",
  "EXP boost via account Cooking LV",
  "EXP boost via Divorce Cake Level",
  "Daily Ribbon gains", // b=3 — not Exp/h
  "EXP boost via total Ribbon Ranks",
  "EXP boost via Mastery Rank",
] as const;

const COOKING_SKILL_IDX = 10; // Lv0[10] = Cooking level per char (N.js CkMst_AcLvT)
const DIVORCE_CAKE_MEAL = 73; // Meals[0][73]
const RIBBON_MEAL_OFFSET = 28; // Ribbon[28+] are the meal ribbons

const num = (v: unknown): number => Number(v) || 0;

export type MasteryInputs = {
  rank: number; // CookMaster[1][0]
  exp: number; // CookMaster[1][1] — exp into current rank
  ladles: number; // CookMaster[1][3]
  totalCookingLv: number; // Σ Lv0[10] over chars (CkMst_AcLvT)
  divorceCakeLv: number; // Meals[0][73]
  totalRibbonRanks: number; // Σ Ribbon[28+] (CkMst_RbLvT)
  purple: number[]; // CookMaster[2][0..5] — Purple PTS per upgrade
  comp87: boolean; // Companion 87 (rift1): +5 pts each colour, ×3 Exp/h
  researchGridYellow: number; // ResearchStuff("Grid_Bonus",190,1) — extra Yellow pts
  externalMulti: number; // product of Purple-independent Exp/h multipliers
};

/** getLOG (N.js) = log base 10 of max(a,1). */
export function getLOG(a: number): number {
  return Math.log(Math.max(a, 1)) / 2.30259;
}

/** base_b — player-state quantity scaled by upgrade b (before coef × Purple). */
export function sourceBase(b: number, inp: MasteryInputs): number {
  switch (b) {
    case 0:
      return getLOG(inp.ladles);
    case 1:
      return Math.max(0, inp.totalCookingLv - 1000);
    case 2:
      return Math.max(0, inp.divorceCakeLv - 75);
    case 4:
      return inp.totalRibbonRanks;
    case 5:
      return inp.rank + 1;
    default:
      return 0; // b=3 (daily ribbon) is not an Exp/h source
  }
}

/** contrib_b, in percentage points = base_b × coef_b × Purple[b]. */
export function sourceContribPct(
  b: number,
  inp: MasteryInputs,
  purple: number[] = inp.purple,
): number {
  return sourceBase(b, inp) * MASTERY_COEF[b] * num(purple[b]);
}

/** Core Exp/h = 2 × ∏_{b∈EXP_UPGRADE_IDS} (1 + contrib_b/100). */
export function expRateCore(inp: MasteryInputs, purple: number[] = inp.purple): number {
  let r = 2;
  for (const b of EXP_UPGRADE_IDS) r *= 1 + sourceContribPct(b, inp, purple) / 100;
  return r;
}

/** Full Exp/h = core × external multipliers (external is Purple-independent). */
export function expRate(inp: MasteryInputs, purple: number[] = inp.purple): number {
  return expRateCore(inp, purple) * inp.externalMulti;
}

/** XP required to advance from `rank` to rank+1. */
export function masteryExpReq(rank: number): number {
  return 100 * Math.pow(2.5, rank) * Math.pow(5, Math.max(0, rank - 40));
}

/** Purple PTS pool total = rank + 1 + 5·comp87 (PtsLeftCook_P, before spending). */
export function purpleTotal(inp: MasteryInputs): number {
  return inp.rank + 1 + (inp.comp87 ? 5 : 0);
}

/** Yellow PTS pool total = purpleTotal + research-grid yellow (PtsLeftCook_Y). */
export function yellowTotal(inp: MasteryInputs): number {
  return purpleTotal(inp) + inp.researchGridYellow;
}

export type ExternalBreakdown = {
  val: number;
  researchGrid190: number; // ResearchStuff("Grid_Bonus",190) — % per the grid square
  superBit68: number; // GamingStatType("SuperBitType",68) — 0/1
  comp87: number; // Companion 87 (rift1) — 0/1
  vial7cm: number; // AlchVials["7cookmastery"] — %
  arcade69: number; // ArcadeBonus(69) — %
  saltLick10: number; // SaltLick(10) — %
};

/**
 * Product of the Exp/h multipliers that are CONSTANT w.r.t. Purple allocation:
 *   (1+ResearchGrid190/100)·(1+40·SuperBit68/100)·(1+2·Comp87)·(1+(vial7cm+Arcade69+SaltLick10)/100)
 *
 * Ported from N.js (`ExpRateCook`), validated to 0.08% against a real save.
 * Reuses the engine's grid/arcade/vial ports. SuperBitType needs Number2Letter
 * (a runtime-only GameAttribute, absent from the JS bundle); since super bits
 * unlock sequentially, Gaming[12] is a prefix of Number2Letter, so bit 68 is
 * owned iff Gaming[12].length > 68. An `extBonusOverrides.cookMasteryExtMulti`
 * number overrides the whole product (e.g. calibrated from an in-game Exp/h).
 */
export function externalExpMulti(s: SaveData): ExternalBreakdown {
  const override = (s.extBonusOverrides as any)?.cookMasteryExtMulti;
  const researchGrid190 = gridBonusValue(190, s);
  const gaming12 = String((s.gamingData as any[])?.[12] ?? "");
  const superBit68 = gaming12.length > 68 ? 1 : 0;
  const comp87 = s.companionIds?.has(87) ? 1 : 0;
  const vial7cm = computeVialByKey("7cookmastery", s).val;
  const arcade69 = arcadeBonus(69, s).val;
  const slLv = Number((s.saltLickData as any[])?.[10]) || 0;
  const saltLick10 = slLv > 0 ? slLv * (Number((SaltLicks as any)?.[10]?.[3]) || 0) : 0;
  const val =
    typeof override === "number" && override > 0
      ? override
      : (1 + researchGrid190 / 100) *
        (1 + (40 * superBit68) / 100) *
        (1 + 2 * comp87) *
        (1 + (vial7cm + arcade69 + saltLick10) / 100);
  return { val, researchGrid190, superBit68, comp87, vial7cm, arcade69, saltLick10 };
}

/** Extracts the mastery inputs from a loaded save. Pre-mastery saves → all zero. */
export function readMasteryInputs(s: SaveData): MasteryInputs {
  const cm = (s.cookMasterData as any[]) || [];
  const meals0 = ((s.mealsData as any[]) || [])[0] || [];
  const ribbon = (s.ribbonData as any[]) || [];
  const lv0All = (s.lv0AllData as any[]) || [];

  let totalCookingLv = 0;
  for (const lv of lv0All) totalCookingLv += num((lv as any[])?.[COOKING_SKILL_IDX]);

  let totalRibbonRanks = 0;
  for (let f = RIBBON_MEAL_OFFSET; f < ribbon.length; f++) totalRibbonRanks += num(ribbon[f]);

  return {
    rank: num(cm[1]?.[0]),
    exp: num(cm[1]?.[1]),
    ladles: num(cm[1]?.[3]),
    totalCookingLv,
    divorceCakeLv: num(meals0[DIVORCE_CAKE_MEAL]),
    totalRibbonRanks,
    purple: Array.from({ length: 6 }, (_, i) => num((cm[2] as any[])?.[i])),
    comp87: s.companionIds?.has(87) ?? false,
    researchGridYellow: 0, // TODO ResearchStuff("Grid_Bonus",190,1)
    externalMulti: externalExpMulti(s).val,
  };
}
