// ===== DERIVED STATS (Max HP / Max MP / Skill Efficiency) =====
// Ports of corgan-source/js/stats/defs/{max-hp,max-mp,skill-efficiency}.js
// re-expressed as plain compute functions (the descriptor `combine` bodies,
// lifted into standalone `computePlayerHPmax / computePlayerMPmax /
// computeSkillEfficiency`). Each returns { val, children } so callers can wire
// the result into the talent-wrap registry or render the breakdown.
//
// Faithful 1:1 with the descriptor combine() logic. A handful of deep
// skill-efficiency sub-sources are NOT yet ported in our codebase
// (Rift skill ETC, Gaming MSA, Divinity bless/minor, Salt Lick / Flurbo shop,
// Journeyman CalcTalent). corgan-source itself already stubs a couple of
// these (GetBuffBonuses → 0, bubonicGreen → 0); we extend that with clearly
// marked [STUB] zeros for the genuinely-unported ones. See SKILL_STUBS note.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";
import { ITEMS } from "../../data/game/items.js";
import {
  equipOrderData,
  equipQtyData,
  currentMapData,
  buffsActiveData,
  optionsListData,
} from "../../../save/data";

import {
  computeTotalStat,
  computeCardBonusByType,
  computeBoxReward,
  computeFamBonusQTY,
} from "./stats";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { goldFoodBonuses } from "./goldenFood";
import { computeCardSetBonus, cardLv } from "./cards";
import { talent } from "./talent";
import { etcBonus } from "./etcBonus";
import { bubbleValByKey, getPrismaBonusMult } from "../w2/alchemy";
import { shrine } from "../w3/construction";
import { computeStatueBonusGiven, computeMealBonus } from "./stats";
import { computeSeraphMulti } from "./starSign";
import { computeShinyBonusS } from "../w4/breeding";
import { votingBonusz } from "../w2/voting";
import { getSetBonus } from "../w3/setBonus";
import { computeVialByKey } from "../w2/alchemy";
import { computeArtifactBonus } from "../w5/sailing";
import { tome } from "../w4/tome";
import { computePaletteBonus } from "../w7/spelunking";
import { computeChipBonus, mainframeBonus } from "../w4/lab";
import { friend } from "./friend";
import { holes } from "../w5/hole";
import { computeAllShimmerBonuses } from "../w3/equinox";
import { companion } from "./companions";
import { winBonus } from "../w6/summoning";
import { guild } from "./guild";
import { prayerBaseBonus } from "../../data/w3/prayer";
import { prayersPerCharData } from "../../../save/data";

// --------------------------------------------------------------------------
// Local helpers (mirror defs/helpers.js safe / rval / safeTree / getBuffBonus)
// --------------------------------------------------------------------------
type Ctx = { saveData: SaveData; charIdx: number; activeCharIdx?: number };

type Tree = { val: number; children?: CorganNode[] | null };

function safe<T extends any[]>(fn: (...a: T) => number, ...args: T): number {
  try {
    const v = fn(...args);
    return v !== v || v == null ? 0 : v;
  } catch {
    return 0;
  }
}

function rval(
  resolver: { resolve: (id: any, ctx: any, args?: any) => CorganNode },
  id: any,
  ctx: any,
  args?: any
): number {
  try {
    return resolver.resolve(id, ctx, args).val || 0;
  } catch {
    return 0;
  }
}

function safeTree(fn: (...a: any[]) => any, ...args: any[]): Tree {
  try {
    const v = fn(...args);
    if (v == null || v !== v) return { val: 0, children: null };
    if (typeof v === "object") {
      const numVal =
        v.val != null
          ? Number(v.val)
          : v.total != null
            ? Number(v.total)
            : v.computed != null
              ? Number(v.computed)
              : Number(v);
      return { val: numVal || 0, children: v.children || null };
    }
    return { val: Number(v) || 0, children: null };
  } catch {
    return { val: 0, children: null };
  }
}

/** GetBuffBonuses(buffId, tab): talent value when the buff is active for the
 *  character, else 0. Mirrors defs/helpers.js getBuffBonus. */
function getBuffBonus(
  buffId: number,
  tab: number | null,
  ci: number,
  ctx: Ctx
): number {
  const charBuffs = (buffsActiveData as any)[ci] || [];
  for (let bi = 0; bi < charBuffs.length; bi++) {
    if (Number(charBuffs[bi][0] || charBuffs[bi]["0"]) === buffId) {
      return rval(talent, buffId, ctx, tab != null ? { tab } : undefined);
    }
  }
  return 0;
}

// --------------------------------------------------------------------------
// Star sign bonus (ported from starSign.js — not exported by our starSign.ts)
// --------------------------------------------------------------------------
// Game hardcodes per-sign bonuses by index (description strings don't match
// keys). Map: effectKey → { signIndex: baseValue }.
const SIGN_BONUSES: Record<string, Record<number, number>> = {
  FightAFK: { 19: 2, 28: 6, 29: -6, 56: 4 },
  SkillAFK: { 20: 2, 25: 1, 29: -6, 55: 4 },
  SkillEXP: { 30: 3, 50: 6 },
  MainXP: { 2: 1, 24: 3, 52: 6 },
  WorshExp: { 46: 15 },
  Drop: { 14: 5, 76: 12 },
  PctDmg: { 0: 1, 32: 2, 51: 20, 53: 6, 54: 15, 70: 25 },
  WepPow: { 12: 2 },
  MoveSpd: { 1: 2, 8: 4, 13: 2, 32: -3, 51: -12 },
  TotalHP: { 28: -80 },
  FoodEffect: { 22: 15 },
};

function getEnabledStarSigns(saveData: SaveData): number {
  const riftLv = Number(saveData.riftData && saveData.riftData[0]) || 0;
  return riftLv >= 10 ? 5 + computeShinyBonusS(3, saveData) : 0;
}

function computeStarSignBonus(
  key: string,
  ci: number,
  saveData: SaveData
): Tree {
  const bonusMap = SIGN_BONUSES[key];
  if (!bonusMap) return { val: 0, children: null };
  const enabled = getEnabledStarSigns(saveData);
  let total = 0;
  const children: CorganNode[] = [];
  const signIndices = Object.keys(bonusMap);
  for (let i = 0; i < signIndices.length; i++) {
    const sigIdx = Number(signIndices[i]);
    const val = bonusMap[sigIdx];
    // Game: if (signIndex > enabledStarSigns - 1) → apply negatives; else skip
    if (val < 0 && sigIdx < enabled) continue;
    total += val;
    children.push(node("Sign " + sigIdx, val, null, { fmt: "raw" }));
  }
  let seraphMulti = 1;
  if (total > 0) {
    seraphMulti = computeSeraphMulti(ci, saveData);
    total *= seraphMulti;
  }
  if (seraphMulti !== 1 && children.length)
    children.push(node("Seraph Multi", seraphMulti, null, { fmt: "x" }));
  return { val: total, children };
}

// ==========================================================================
// MAX HP — _customBlock_PlayerHPmax: LIST[0] × LIST[1] × LIST[2]
// ==========================================================================
export function computePlayerHPmax(charIdx: number, ctx: Ctx): Tree {
  const s = ctx.saveData;
  const ci = charIdx ?? ctx.charIdx ?? 0;

  const strResult = computeTotalStat("STR", ci, ctx);
  const totalSTR = strResult.computed;

  // LIST[0] — Base HP
  const _cardBonus1T = safeTree(computeCardBonusByType, 1, ci, s);
  const cardBonus1 = _cardBonus1T.val;
  const _bubbleBaseHPT = safeTree(bubbleValByKey, "BaseHP", ci, s);
  const bubbleBaseHP = _bubbleBaseHPT.val;
  const _stampBaseHPT = safeTree(computeStampBonusOfTypeX, "BaseHP", s);
  const stampBaseHP = _stampBaseHPT.val;
  const _statue4T = safeTree(computeStatueBonusGiven, 4, ci, s);
  const statue4 = _statue4T.val;
  const talent0 = rval(talent, 0, ctx);
  const talent642 = rval(talent, 642, ctx);
  const talent95 = rval(talent, 95, ctx);
  const _brHP = computeBoxReward(ci, "baseHP");
  const boxBaseHP = _brHP.val || 0;
  const strPortion = Math.pow(totalSTR * (1 + talent95 / 100), 1.05);

  // Food HP Base Boosts — scan food bag for HpBaseBoosts items × food effect
  const _bBox = computeBoxReward(ci, "PowerFoodEffect");
  const _bBoxVal = _bBox.val || 0;
  const _bStatue3T = safeTree(computeStatueBonusGiven, 3, ci, s);
  const _bStatue3 = _bStatue3T.val;
  const _bStampT = safeTree(computeStampBonusOfTypeX, "BFood", s);
  const _bStampVal = _bStampT.val;
  const _bStarT = computeStarSignBonus("FoodEffect", ci, s);
  const _bStar = _bStarT.val;
  const _bCard48T = safeTree(computeCardBonusByType, 48, ci, s);
  const _bCard48 = _bCard48T.val;
  const _bT631 = rval(talent, 631, ctx);
  const _bEtc9 = rval(etcBonus, "9", ctx);
  const _bCardSet01T = safeTree(computeCardSetBonus, ci, "1");
  const _bCardSet01 = _bCardSet01T.val || 0;
  const boostEff =
    1 +
    (_bBoxVal +
      _bStatue3 +
      _bEtc9 +
      _bStampVal +
      _bStar +
      _bCard48 +
      _bCardSet01 +
      _bT631) /
      100;
  const boostEffChildren: CorganNode[] = [
    node("Box PowerFoodEffect", _bBoxVal, null, { fmt: "raw" }),
    node("Statue 3", _bStatue3, _bStatue3T.children, { fmt: "raw" }),
    node("Stamp BFood", _bStampVal, _bStampT.children, { fmt: "raw" }),
    node("Star Sign FoodEffect", _bStar, _bStarT.children, { fmt: "raw" }),
    node("Cards (type 48)", _bCard48, _bCard48T.children, { fmt: "raw" }),
    node("Talent 631", _bT631, null, { fmt: "raw" }),
    node("EtcBonus 9", _bEtc9, null, { fmt: "raw" }),
    node("CardSet 1", _bCardSet01, _bCardSet01T.children, { fmt: "raw" }),
  ];

  let foodHPdn = 0;
  const foodHPchildren: CorganNode[] = [];
  try {
    const foodBag =
      (equipOrderData as any) && (equipOrderData as any)[ci] && (equipOrderData as any)[ci][2];
    const foodQty =
      (equipQtyData as any) && (equipQtyData as any)[ci] && (equipQtyData as any)[ci][2];
    for (let fi = 0; fi < 16; fi++) {
      const fn2 = foodBag && foodBag[fi];
      if (
        fn2 &&
        fn2 !== "Blank" &&
        (ITEMS as any)[fn2] &&
        (ITEMS as any)[fn2].Effect === "HpBaseBoosts"
      ) {
        const qty = Number((foodQty && foodQty[fi]) || 0);
        if (qty > 0) {
          const amt = Number((ITEMS as any)[fn2].Amount) || 0;
          const contrib = amt * boostEff;
          foodHPdn += contrib;
          foodHPchildren.push(
            node(fn2, contrib, null, {
              fmt: "raw",
              note: "base " + amt + " × " + boostEff.toFixed(3),
            })
          );
        }
      }
    }
  } catch {
    /* food bag missing */
  }
  // Statue 4 is added flat into PlayerHPmaxDN
  foodHPdn += statue4;

  const list0 =
    15 +
    cardBonus1 +
    bubbleBaseHP +
    stampBaseHP +
    foodHPdn +
    boxBaseHP +
    talent0 +
    talent642 +
    strPortion;

  // LIST[1] — Pct multiplier
  const talent92 = rval(talent, 92, ctx);
  const talent272 = rval(talent, 272, ctx);
  const etc15 = rval(etcBonus, "15", ctx);
  const shrine1 = rval(shrine, 1, ctx);
  const _brPctHP = computeBoxReward(ci, "pctHP");
  const boxPctHP = _brPctHP.val || 0;
  const famBonus18 = safe(computeFamBonusQTY, 18, s);
  const _cardBonus8T = safeTree(computeCardBonusByType, 8, ci, s);
  const cardBonus8 = _cardBonus8T.val;
  const _starSignHPT = computeStarSignBonus("TotalHP", ci, s);
  const starSignHP = _starSignHPT.val;

  let list1 = (1 + (talent92 + talent272 + etc15) / 100) * (1 + shrine1 / 100);

  // GoldFoodBonuses("MaxHPpct")
  const _gfHPT = safeTree(goldFoodBonuses, "MaxHPpct", ci, undefined, s);
  const gfHPpct = _gfHPT.val > 0 ? 1 + _gfHPT.val / 100 : 1;
  list1 *= gfHPpct;

  // GetBuffBonuses(108,1) — HP reduction debuff (1 - buff/100)
  const buff108 = getBuffBonus(108, 1, ci, ctx);
  list1 *= 1 - buff108 / 100;

  list1 *=
    (1 + boxPctHP / 100) *
    (1 + (famBonus18 + cardBonus8) / 100) *
    (1 + starSignHP / 100);

  // LIST[2] — normally 1, but 164 for maps 20-23
  let list2 = 1;
  const mapIdx = ((currentMapData as any) && (currentMapData as any)[ci]) || 0;
  if (mapIdx > 19 && mapIdx < 24) list2 = 164;

  const val = list0 * list1 * list2;

  const children: CorganNode[] = [
    node("Base HP (LIST[0])", list0, [
      node("Constant", 15, null, { fmt: "raw" }),
      node("STR Portion", strPortion, null, {
        fmt: "raw",
        note: "pow(STR×(1+t95/100), 1.05)",
      }),
      node("Card Bonus 1", cardBonus1, _cardBonus1T.children, { fmt: "raw" }),
      node("Bubble BaseHP", bubbleBaseHP, _bubbleBaseHPT.children, { fmt: "raw" }),
      node("Stamp BaseHP", stampBaseHP, _stampBaseHPT.children, { fmt: "raw" }),
      node(
        "Food HP + Statue 4",
        foodHPdn,
        [node("Boost Effect Multi", boostEff, boostEffChildren, { fmt: "x" })]
          .concat(foodHPchildren)
          .concat([
            node("Statue 4 (flat add)", statue4, _statue4T.children, { fmt: "raw" }),
          ]),
        { fmt: "raw" }
      ),
      node("Talents 0+642", talent0 + talent642, null, { fmt: "raw" }),
      node("Box Rewards", boxBaseHP, null, { fmt: "raw" }),
    ], { fmt: "raw" }),
    node("Pct Multiplier (LIST[1])", list1, [
      node("Talents 92+272", talent92 + talent272, null, { fmt: "raw" }),
      node("EtcBonus 15", etc15, null, { fmt: "raw" }),
      node("Shrine 1", shrine1, null, { fmt: "raw" }),
      node("Golden Food MaxHPpct", gfHPpct, _gfHPT.children, { fmt: "x" }),
      node("Box pctHP", boxPctHP, null, { fmt: "raw" }),
      node("Family Bonus 18", famBonus18, null, { fmt: "raw" }),
      node("Card Bonus 8", cardBonus8, _cardBonus8T.children, { fmt: "raw" }),
      node("Star Signs HP", starSignHP, _starSignHPT.children, { fmt: "raw" }),
      node("Buff 108 (HP debuff)", buff108 ? -buff108 : 0, null, {
        fmt: "raw",
        note: "×(1-buff/100)",
      }),
    ], { fmt: "x" }),
    node("LIST[2]", list2, null, {
      fmt: "x",
      note: mapIdx > 19 && mapIdx < 24 ? "Maps 20-23 override" : "normal",
    }),
  ];

  return { val, children };
}

// ==========================================================================
// MAX MP — _customBlock_PlayerMPmax: LIST[0] × LIST[1]
// ==========================================================================
export function computePlayerMPmax(charIdx: number, ctx: Ctx): Tree {
  const s = ctx.saveData;
  const ci = charIdx ?? ctx.charIdx ?? 0;

  const wisResult = computeTotalStat("WIS", ci, ctx);
  const totalWIS = wisResult.computed;

  // LIST[0] — Base MP
  const _cardBonus3T = safeTree(computeCardBonusByType, 3, ci, s);
  const cardBonus3 = _cardBonus3T.val;
  const _bubbleBaseMPT = safeTree(bubbleValByKey, "BaseMP", ci, s);
  const bubbleBaseMP = _bubbleBaseMPT.val;
  const _stampBaseMPT = safeTree(computeStampBonusOfTypeX, "BaseMP", s);
  const stampBaseMP = _stampBaseMPT.val;
  const talent1 = rval(talent, 1, ctx);
  const _brMP = computeBoxReward(ci, "baseMP");
  const boxBaseMP = _brMP.val || 0;

  const list0 =
    10 + cardBonus3 + bubbleBaseMP + stampBaseMP + talent1 + totalWIS + boxBaseMP;

  // LIST[1] — Pct multiplier
  const talent452 = rval(talent, 452, ctx);
  const talent272 = rval(talent, 272, ctx);
  const _brPctMP = computeBoxReward(ci, "pctMP");
  const boxPctMP = _brPctMP.val || 0;
  const _cardBonus29T = safeTree(computeCardBonusByType, 29, ci, s);
  const cardBonus29 = _cardBonus29T.val;

  const list1 =
    (1 + (talent452 + talent272) / 100) *
    (1 + (boxPctMP + cardBonus29) / 100);

  const val = list0 * list1;

  const children: CorganNode[] = [
    node("Base MP (LIST[0])", list0, [
      node("Constant", 10, null, { fmt: "raw" }),
      node("Total WIS", totalWIS, null, { fmt: "raw" }),
      node("Card Bonus 3", cardBonus3, _cardBonus3T.children, { fmt: "raw" }),
      node("Bubble BaseMP", bubbleBaseMP, _bubbleBaseMPT.children, { fmt: "raw" }),
      node("Stamp BaseMP", stampBaseMP, _stampBaseMPT.children, { fmt: "raw" }),
      node("Talent 1", talent1, null, { fmt: "raw" }),
      node("Box Rewards", boxBaseMP, null, { fmt: "raw" }),
    ], { fmt: "raw" }),
    node("Pct Multiplier (LIST[1])", list1, [
      node("Talents 452+272", talent452 + talent272, null, { fmt: "raw" }),
      node("Box pctMP", boxPctMP, null, { fmt: "raw" }),
      node("Card Bonus 29", cardBonus29, _cardBonus29T.children, { fmt: "raw" }),
    ], { fmt: "x" }),
  ];

  return { val, children };
}

// ==========================================================================
// SKILL EFFICIENCY — ported from defs/skill-efficiency.js
// ==========================================================================
// [STUB] The following sub-sources are referenced by computeAllEfficiencies /
// computeAllBaseSkillEff / computeCalcTalent in corgan-source but are NOT yet
// ported in our codebase. They return 0 here (clearly marked). corgan-source
// itself stubs GetBuffBonuses(40,2)→0. Real impact on Fishing efficiency is
// modest (these are minor additive % sources). Port them properly when the
// w4/rift, w4/gaming, w5/divinity-bless/minor, w3 salt-lick/flurbo, and
// common/calcTalent systems land.
const computeRiftSkillETC = (_idx: number, _s: SaveData): number => 0; // [STUB] w4/rift
const computeMSABonus = (_idx: number, _s: SaveData): number => 0; // [STUB] w4/gaming
const computeDivinityBless = (_idx: number, _s: SaveData): number => 0; // [STUB] w5/divinity
const computeCalcTalent = (
  _talentIdx: number,
  _skillSlot: number,
  _ci: number,
  _s: SaveData
): number => 0; // [STUB] common/calcTalent (needs charClassAllData)

function computePrayerReal(
  prayerIdx: number,
  costIdx: number,
  ci: number,
  saveData: SaveData
): number {
  const s = saveData;
  const prayerLv = Number(s.prayOwnedData && s.prayOwnedData[prayerIdx]) || 0;
  if (prayerLv <= 0) return 0;
  let equipped = false;
  try {
    equipped = ((prayersPerCharData as any)[ci] || []).includes(prayerIdx);
  } catch {
    /* missing */
  }
  if (!equipped) return 0;
  const base = safe(prayerBaseBonus, prayerIdx, costIdx);
  const scale = Math.max(1, 1 + (prayerLv - 1) / 10);
  return Math.round(base * scale);
}

// AllEfficiencies: shared multiplier for ALL skill efficiencies (6 groups)
function computeAllEfficiencies(ci: number, ctx: Ctx): number {
  const famBonus42 = safe(computeFamBonusQTY, 42, ctx.saveData);
  const etc48 = rval(etcBonus, "48", ctx);
  const vial6SkillEff = safe((k: string, s: SaveData) => computeVialByKey(k, s).val, "6SkillEff", ctx.saveData);
  const artifactBonus15 = safe(computeArtifactBonus, 15, ci, ctx as any);
  const talent617 = rval(talent, 617, ctx);
  const questEff = Math.min(
    0.1 * (ctx.saveData ? ctx.saveData.totalQuestsComplete || 0 : 0),
    talent617
  );

  const g1 =
    1 +
    (famBonus42 + etc48 + vial6SkillEff + artifactBonus15 + Math.min(questEff, talent617)) /
      100;

  const mealSeff = safe((k: string, s: SaveData) => computeMealBonus(k, s).val, "Seff", ctx.saveData);
  const talent646 = rval(talent, 646, ctx);
  const tomeBonus1 = rval(tome, 1, ctx);
  const paletteBonus10 = safe(computePaletteBonus, 10, ctx.saveData);
  const chipToteff = safe(computeChipBonus, "toteff");
  const cardCrystal4 = 3 * safe(cardLv, "Crystal4", ctx.saveData);
  const friendStatz2 = rval(friend, 2, ctx);
  const riftSkillETC2 = safe(computeRiftSkillETC, 2, ctx.saveData);
  const holesB49_15 = rval(holes, 49 as any, ctx);
  const ola422 = Number((optionsListData as any)[422]) || 0;
  const shimmerOla180 = Number((optionsListData as any)[180]) || 0;
  const shimmerBonus = safe(computeAllShimmerBonuses, ctx.saveData);

  const g2 =
    1 +
    (mealSeff +
      talent646 +
      tomeBonus1 +
      paletteBonus10 +
      chipToteff +
      cardCrystal4 +
      friendStatz2 +
      riftSkillETC2 +
      holesB49_15 +
      ola422 +
      shimmerOla180 * shimmerBonus) /
      100;

  const _cb84 = safeTree(computeCardBonusByType, 84, ci, ctx.saveData);
  const card84 = _cb84.val;
  const comp5 = rval(companion, 5, ctx);
  const g3 = 1 + (card84 + comp5) / 100;

  const winBonus14 = rval(winBonus, 14, ctx);
  const g4 = 1 + winBonus14 / 100;

  const guild6 = rval(guild, 6, ctx);
  const cardSet2 = safe((c: number, k: string) => computeCardSetBonus(c, k).val, ci, "2");
  const prayer1 = computePrayerReal(1, 0, ci, ctx.saveData);
  const g5 = 1 + (guild6 + cardSet2 + prayer1) / 100;

  // Negative group: max(1 - (BuffBonus(40,2) + prayer17curse)/100, 0.01)
  const buffBonus40_2 = 0; // [STUB] GetBuffBonuses(40,2) — session-only (matches corgan-source)
  const prayer17curse = computePrayerReal(17, 1, ci, ctx.saveData);
  const g6 = Math.max(1 - (buffBonus40_2 + prayer17curse) / 100, 0.01);

  return g1 * g2 * g3 * g4 * g5 * g6;
}

// AllBaseSkillEff: flat base efficiency shared across skills
function computeAllBaseSkillEff(ci: number, ctx: Ctx): number {
  const shiny22 = safe(computeShinyBonusS, 22, ctx.saveData);
  const stampBaseAllEff = safe((k: string, s: SaveData) => computeStampBonusOfTypeX(k, s).val, "BaseAllEff", ctx.saveData);
  const divBless2 = safe(computeDivinityBless, 2, ctx.saveData);
  const _br20b = computeBoxReward(ci, "20b");
  const boxReward20b = _br20b.val || 0;
  const chipEff = safe(computeChipBonus, "eff");
  const talent636 = rval(talent, 636, ctx);
  const mf112 = safe(mainframeBonus, 112, ctx.saveData);

  return (
    shiny22 + stampBaseAllEff + divBless2 + boxReward20b + chipEff + talent636 + mf112
  );
}

// Per-skill config (1:1 with skill-efficiency.js SKILL_CONFIG, with Fishing).
type SkillCfg = {
  toolSlot: [number, number];
  stat: string;
  statIdx: number;
  flat: number;
  toolBubble: string;
  toolTalent: number;
  skillLvIdx: number;
  effTalent: number;
  stampType: string;
  boxPctKey: string;
  calcTalentRow: [number, number];
  perSkillMultFn: (ci: number, ctx: Ctx) => number;
};

const SKILL_CONFIG: Record<string, SkillCfg> = {
  Mining: {
    toolSlot: [1, 0], stat: "STR", statIdx: 0, flat: 12,
    toolBubble: "ToolW", toolTalent: 103, skillLvIdx: 1,
    effTalent: 142, stampType: "BaseMinEff", boxPctKey: "MinEffPct",
    calcTalentRow: [43, 0],
    perSkillMultFn(ci, ctx) {
      const talent85 = rval(talent, 85, ctx);
      const etc10 = rval(etcBonus, "10", ctx);
      const voting7 = safe(votingBonusz, 7, 1, ctx.saveData);
      const copperSet = safe((k: string) => getSetBonus(k).val, "COPPER_SET");
      return 1 + (talent85 + etc10 + voting7 + copperSet) / 100;
    },
  },
  Choppin: {
    toolSlot: [1, 1], stat: "WIS", statIdx: 2, flat: 12,
    toolBubble: "ToolA", toolTalent: 283, skillLvIdx: 3,
    effTalent: 532, stampType: "BaseChopEff", boxPctKey: "ChopEffPct",
    calcTalentRow: [43, 2],
    perSkillMultFn(ci, ctx) {
      const talent265 = rval(talent, 265, ctx);
      const etc11 = rval(etcBonus, "11", ctx);
      const voting8 = safe(votingBonusz, 8, 1, ctx.saveData);
      return 1 + (talent265 + etc11 + voting8) / 100;
    },
  },
  Fishing: {
    toolSlot: [1, 2], stat: "STR", statIdx: 0, flat: 12,
    toolBubble: "ToolG", toolTalent: 283, skillLvIdx: 4,
    effTalent: 142, stampType: "BaseFishEff", boxPctKey: "FishEffPct",
    calcTalentRow: [43, 3],
    perSkillMultFn(ci, ctx) {
      const talent355 = rval(talent, 355, ctx);
      const etc12 = rval(etcBonus, "12", ctx);
      const voting9 = safe(votingBonusz, 9, 1, ctx.saveData);
      return 1 + (talent355 + etc12 + voting9) / 100;
    },
  },
  Catching: {
    toolSlot: [1, 3], stat: "AGI", statIdx: 1, flat: 10,
    toolBubble: "ToolA", toolTalent: 283, skillLvIdx: 6,
    effTalent: 367, stampType: "BaseCatchEff", boxPctKey: "CatchEffPct",
    calcTalentRow: [43, 5],
    perSkillMultFn(ci, ctx) {
      const talent450 = rval(talent, 450, ctx);
      const etc13 = rval(etcBonus, "13", ctx);
      return 1 + (talent450 + etc13) / 100;
    },
  },
};

/** computeSkillEfficiency("Fishing"|"Mining"|..., charIdx, ctx). */
export function computeSkillEfficiency(
  skillName: string,
  charIdx: number,
  ctx: Ctx
): Tree {
  const s = ctx.saveData;
  if (!s) return { val: 0, children: null };
  const ci = charIdx ?? ctx.charIdx ?? 0;
  const skillType = skillName || "Mining";

  const sk = SKILL_CONFIG[skillType];
  if (!sk)
    return {
      val: 0,
      children: [node("Unknown skill: " + skillType, 0, null, { fmt: "raw" })],
    };

  // 1. Tool weapon power from equipped tool
  let wpRaw = 0;
  const equipRow = sk.toolSlot[0];
  const equipSlot = sk.toolSlot[1];
  const equipOrder = (s as any).equipOrderData ?? (equipOrderData as any);
  const equipMap = (s as any).equipMapData ?? (s as any).emmData;
  if (
    equipOrder &&
    equipOrder[ci] &&
    equipOrder[ci][equipRow] &&
    equipOrder[ci][equipRow][equipSlot] !== "Blank"
  ) {
    const itemName = equipOrder[ci][equipRow][equipSlot];
    if (ITEMS && (ITEMS as any)[itemName]) {
      wpRaw = Number((ITEMS as any)[itemName].Weapon_Power) || 0;
      if (
        equipMap &&
        equipMap[ci] &&
        equipMap[ci][equipRow] &&
        equipMap[ci][equipRow][equipSlot]
      ) {
        wpRaw += Number(equipMap[ci][equipRow][equipSlot].Weapon_Power) || 0;
      }
    }
  }

  // 2. Tool bubble + talent scaling
  const toolBubble = safe((k: string, c: number, sv: SaveData) => bubbleValByKey(k, c, sv).val, sk.toolBubble, ci, s);
  const skillLv =
    Number(s.lv0AllData && s.lv0AllData[ci] && s.lv0AllData[ci][sk.skillLvIdx]) || 0;
  const toolTalent = rval(talent, sk.toolTalent, ctx);
  const skillStatsDN =
    wpRaw * (1 + (toolTalent * (skillLv / 10)) / 100) * (1 + toolBubble / 100) + 4;

  // 3. Main efficiency formula
  const _statR = computeTotalStat(sk.stat, ci, ctx);
  const totalStat = _statR.computed;
  const effTalent = rval(talent, sk.effTalent, ctx);
  const stampBase = safe((k: string, sv: SaveData) => computeStampBonusOfTypeX(k, sv).val, sk.stampType, s);
  const allBaseEff = computeAllBaseSkillEff(ci, ctx);

  const inner =
    Math.pow(skillStatsDN, 1.3) +
    Math.pow(totalStat + 1, 0.6) * (1 + effTalent / 100) +
    stampBase +
    allBaseEff;

  const skillLvMult = 1 + skillLv / 200;
  const _brBox = computeBoxReward(ci, sk.boxPctKey);
  const boxPct = _brBox.val || 0;
  const calcTalent = safe(
    computeCalcTalent,
    sk.calcTalentRow[0],
    sk.calcTalentRow[1],
    ci,
    s
  );
  const boxCalcMult = 1 + (boxPct + calcTalent) / 100;

  // STR/WIS/AGI^0.35 scaling
  let statPowMult = 1;
  if (sk.stat === "STR" || sk.stat === "WIS" || sk.stat === "AGI") {
    statPowMult = 1 + Math.pow(totalStat / 100, 0.35) * (1 + effTalent / 100);
  }

  let gfMult = 1;
  try {
    const gf = goldFoodBonuses(skillType + "Eff", ci, undefined, s);
    gfMult = gf && typeof gf === "object" ? Number(gf.total) || 1 : Number(gf) || 1;
  } catch {
    /* missing */
  }

  const allEff = computeAllEfficiencies(ci, ctx);
  const perSkillMult = sk.perSkillMultFn ? sk.perSkillMultFn(ci, ctx) : 1;

  let val =
    (sk.flat + inner) *
    skillLvMult *
    boxCalcMult *
    statPowMult *
    gfMult *
    allEff *
    perSkillMult;
  if (val !== val || val == null) val = 0;

  const children: CorganNode[] = [];
  children.push(
    node("Tool Power", skillStatsDN, null, {
      fmt: "raw",
      note: "WP=" + wpRaw + " bubble=" + toolBubble.toFixed(1),
    })
  );
  children.push(node("Inner (Power + Stat + Base)", sk.flat + inner, null, { fmt: "raw" }));
  children.push(
    node("Skill Level /200", skillLvMult, null, {
      fmt: "x",
      note: skillType + " lv=" + skillLv,
    })
  );
  children.push(node("Stat^0.35 Multi", statPowMult, null, { fmt: "x" }));
  children.push(node("Box + CalcTalent Multi", boxCalcMult, null, { fmt: "x" }));
  children.push(node("All Efficiencies", allEff, null, { fmt: "x" }));
  children.push(node(skillType + " Multipliers", perSkillMult, null, { fmt: "x" }));
  if (gfMult > 1)
    children.push(
      node("Golden Food: " + skillType + " Efficiency", gfMult, null, { fmt: "x" })
    );

  void label; // label kept available for future friendly naming
  return { val, children };
}
