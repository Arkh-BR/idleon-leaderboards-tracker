// Cooking Mastery progression and Exp/h, from the N.js `_customBlock_Summoning2` keys ExpRateCook, BonusAmountcook,
// ExpReqCook, RankREQcook and PtsLeftCook_*. Literal source snippets and the index map: MECHANICS.md.
//
// Save shape, CookMaster (2D): [0][g] = Yellow PTS per meal, [1] = mastery state ([0] rank, [1] exp, [3] ladles),
// [2][b] = Purple PTS per upgrade b (0..5). Exp/h is multiplicative across the upgrades; Yellow PTS do not feed it.
//
// The optimizer re-prices Purple allocations the player does not have, so the inputs are read once from the save and
// the core formula is plain math over them. `Summoning2("ExpRateCook")` stays the game's own number: `expRateTree` checks against it.
import { asNum } from "@/lib/game/attr";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { RandoListo2 } from "@/lib/game/data";
import { listAt } from "@/lib/game/lists";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { Companions } from "@/lib/game/njs/Companions";
import { DNSM_AlchVials } from "@/lib/game/njs/DNSM";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { MenagerieStuff } from "@/lib/game/njs/MenagerieStuff";
import { ResearchStuff } from "@/lib/game/njs/ResearchStuff";
import { SaltLick } from "@/lib/game/njs/SaltLick";
import { Summoning } from "@/lib/game/njs/Summoning";
import { playerCount } from "@/lib/game/player";

// @njs RandoListo2[8]
/** RandoListo2[8]: the coefficient of each upgrade b (0..5). */
export const MASTERY_COEF = ((RandoListo2 as unknown as readonly (readonly unknown[])[])[8].slice(0, 6) as readonly (string | number)[]).map(Number);
// RankREQcook: the mastery rank that unlocks upgrade b.
export const MASTERY_RANK_REQ = [0, 1, 5, 10, 25, 100] as const;
// Upgrades that feed Exp/h. b = 3 ("daily Ribbon gains") is not one of them.
export const EXP_UPGRADE_IDS = [0, 1, 2, 4, 5] as const;

// Display names (game strings "EXP_boost_via_…"); index = upgrade id.
export const UPGRADE_NAMES = [
  "EXP boost via Ladle",
  "EXP boost via account Cooking LV",
  "EXP boost via Divorce Cake Level",
  "Daily Ribbon gains", // b=3, not Exp/h
  "EXP boost via total Ribbon Ranks",
  "EXP boost via Mastery Rank",
] as const;

const COOKING_SKILL_IDX = 10; // Lv0[10], N.js DNSM.CkMst_AcLvT
const DIVORCE_CAKE_MEAL = 73; // Meals[0][73]
const RIBBON_MEAL_OFFSET = 28; // Ribbon[28+] are the meal ribbons

export type MasteryInputs = {
  rank: number; // CookMaster[1][0]
  exp: number; // CookMaster[1][1], exp into the current rank
  ladles: number; // CookMaster[1][3]
  totalCookingLv: number; // Σ Lv0[10] over the characters (CkMst_AcLvT)
  divorceCakeLv: number; // Meals[0][73]
  totalRibbonRanks: number; // Σ Ribbon[28+] (CkMst_RbLvT)
  purple: number[]; // CookMaster[2][0..5]
  comp87: number; // Companions(87): 0 none, 1 stage 1, 1.5 stage 2
  evShop54: boolean; // Event Shop 54 (Bejeweled Ladle): +5 pts each colour
  jelly13: number; // JellyOperation("RoG_BonusQTY", 13): Purple pts
  jelly5: number; // JellyOperation("RoG_BonusQTY", 5): Yellow pts
  researchGridYellow: number; // ResearchStuff("Grid_Bonus", 190, 1): Yellow pts
  externalMulti: number; // product of the Purple-independent Exp/h multipliers
};

/** getLOG (N.js): ln(max(a, 1)) / 2.30259. A pure copy, because the what-ifs have no ctx. */
export function getLOG(a: number): number {
  return Math.log(Math.max(a, 1)) / 2.30259;
}

/** base_b: the player-state quantity scaled by upgrade b (before coef × Purple). */
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
export function sourceContribPct(b: number, inp: MasteryInputs, purple: number[] = inp.purple): number {
  return sourceBase(b, inp) * MASTERY_COEF[b] * (Number(purple[b]) || 0);
}

/** Core Exp/h = 2 × ∏_{b∈EXP_UPGRADE_IDS} (1 + contrib_b/100). */
export function expRateCore(inp: MasteryInputs, purple: number[] = inp.purple): number {
  let r = 2;
  for (const b of EXP_UPGRADE_IDS) r *= 1 + sourceContribPct(b, inp, purple) / 100;
  return r;
}

/** Full Exp/h = core × external multipliers. */
export function expRate(inp: MasteryInputs, purple: number[] = inp.purple): number {
  return expRateCore(inp, purple) * inp.externalMulti;
}

/** XP required to advance from `rank` to rank + 1 (ExpReqCook). */
export function masteryExpReq(rank: number): number {
  return 100 * Math.pow(2.5, rank) * Math.pow(5, Math.max(0, rank - 40));
}

// PtsLeftCook_P/Y before spending: rank + 1 + 5·EventShop54 + 5·Companions(87) + the jelly bonus. The game rounds the whole pool
// (Companions(87) at stage 2 gives 7.5).
function ptsPool(inp: MasteryInputs, jelly: number): number {
  return inp.rank + 1 + 5 * inp.comp87 + (inp.evShop54 ? 5 : 0) + jelly;
}

// @njs PtsLeftCook_P
/** The Purple PTS pool, before spending. */
export function purpleTotal(inp: MasteryInputs): number {
  return Math.round(ptsPool(inp, inp.jelly13));
}

// @njs PtsLeftCook_Y
/** The Yellow PTS pool, before spending. */
export function yellowTotal(inp: MasteryInputs): number {
  return Math.round(ptsPool(inp, inp.jelly5) + inp.researchGridYellow);
}

export type ExternalBreakdown = {
  val: number;
  researchGrid190: number; // ResearchStuff("Grid_Bonus", 190, 0), %
  superBit68: number; // GamingStatType("SuperBitType", 68), 0 or 1
  comp87: number; // Companions(87)
  vial7cm: number; // DNSM.AlchVials["7cookmastery"], %
  arcade69: number; // ArcadeBonus(69), %
  saltLick10: number; // SaltLick(10), %
  fountainCookMaxxing: number; // Holes2("Fountain_BonTOT", 2, 17), %
  menagerieBoost21: number; // MenagerieStuff("BoostQTY", 21), %
};

/** The ExpRateCook factors that do not depend on the Purple allocation (@10934618). */
export function externalExpMulti(ctx: Ctx): ExternalBreakdown {
  const researchGrid190 = ResearchStuff(ctx, "Grid_Bonus", 190, 0);
  const superBit68 = GamingStatType(ctx, "SuperBitType", 68, 0);
  const comp87 = Companions(ctx, 87);
  const vial7cm = DNSM_AlchVials(ctx, "7cookmastery");
  const arcade69 = ArcadeBonus(ctx, 69);
  const saltLick10 = SaltLick(ctx, 10);
  const fountainCookMaxxing = Holes2(ctx, "Fountain_BonTOT", 2, 17);
  const menagerieBoost21 = MenagerieStuff(ctx, "BoostQTY", 21, 0);
  const val =
    (1 + menagerieBoost21 / 100) *
    (1 + researchGrid190 / 100) *
    (1 + (40 * superBit68) / 100) *
    (1 + 2 * comp87) *
    (1 + fountainCookMaxxing / 100) *
    (1 + (vial7cm + (arcade69 + saltLick10)) / 100);
  return { val, researchGrid190, superBit68, comp87, vial7cm, arcade69, saltLick10, fountainCookMaxxing, menagerieBoost21 };
}

/** The optimizer's inputs, read from the save through the game's blocks. */
export function readMasteryInputs(ctx: Ctx): MasteryInputs {
  let totalCookingLv = 0;
  for (let c = 0, n = playerCount(ctx); c < n; c++) totalCookingLv += asNum(withPlayer(ctx, c), "Lv0", COOKING_SKILL_IDX);
  const ribbon = listAt(ctx, "Ribbon");
  let totalRibbonRanks = 0;
  for (let f = RIBBON_MEAL_OFFSET; f < ribbon.length; f++) totalRibbonRanks += asNum(ctx, "Ribbon", f);
  listAt(ctx, "CookMaster", 2); // the game indexes CookMaster[2][b] directly
  return {
    rank: asNum(ctx, "CookMaster", 1, 0),
    exp: asNum(ctx, "CookMaster", 1, 1),
    ladles: asNum(ctx, "CookMaster", 1, 3),
    totalCookingLv,
    divorceCakeLv: asNum(ctx, "Meals", 0, DIVORCE_CAKE_MEAL),
    totalRibbonRanks,
    purple: Array.from({ length: 6 }, (_, i) => asNum(ctx, "CookMaster", 2, i)),
    comp87: Companions(ctx, 87),
    evShop54: 1 == Summoning(ctx, "EventShopOwned", 54, 0),
    jelly13: JellyOperation(ctx, "RoG_BonusQTY", 13, 0),
    jelly5: JellyOperation(ctx, "RoG_BonusQTY", 5, 0),
    researchGridYellow: ResearchStuff(ctx, "Grid_Bonus", 190, 1),
    externalMulti: externalExpMulti(ctx).val,
  };
}
