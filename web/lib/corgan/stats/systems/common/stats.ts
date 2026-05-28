// ===== STATS SYSTEM (W stage-4 stub for lukScaling) =====
//
// Corgan's stats.js is 1380+ lines computing the full TotalStat chain
// (equip base + gallery + obols + alchemy bubbles + stamps + AllStatPCT
// from 16 sub-sources + star signs + etc.). Porting that completely is
// Stage 5 work — for the DR descriptor we only need the luk multiplier
// `1.4 × lukCurve(LUK)`.
//
// Pragmatic port: read raw LUK from PersonalValuesMap (already populated
// in stats.ts state via PVStatList_N → save loader doesn't currently
// extract that — we read directly from the save via `lv0AllData` instead,
// where indexes 4-7 hold STR/AGI/WIS/LUK with talent + card bonuses
// already baked in). This matches what the IT-port reads and bate exact
// with IT's /characters page. Stage 5 will swap in the full chain when
// `computeTotalStat` ports.

import { node, type CorganNode } from "../../../node";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export function lukCurve(luk: number): number {
  if (!Number.isFinite(luk) || luk < 0) return 0;
  if (luk < 1e3) {
    return (Math.pow(luk + 1, 0.37) - 1) / 40;
  }
  return ((luk - 1e3) / (luk + 2500)) * 0.5 + 0.297;
}

function readRawLuk(saveData: SaveData, charIdx: number): number {
  // Loader stashes PVStatList_N arrays (already populated with talent +
  // card LUK bonuses) under saveData.statList. PersonalValuesMap.StatList
  // index 3 == LUK in IT's parser and matches the game's StatList layout.
  const sl: any = (saveData as any).statList;
  if (Array.isArray(sl) && Array.isArray(sl[charIdx])) {
    return Number(sl[charIdx][3]) || 0;
  }
  return 0;
}

export const lukScaling = {
  resolve(_id: unknown, ctx: Ctx): CorganNode {
    const charIdx = ctx.charIdx;
    const totalLUK = readRawLuk(ctx.saveData, charIdx);
    const drLUK = lukCurve(totalLUK);
    return node("LUK Scaling", drLUK, [
      // 🍀 sits on the actual character stat — the parent LUK Scaling wrapper
      // and the sibling × 1.4 row are math glue, not the stat itself.
      node("🍀 Total LUK", totalLUK, null, { fmt: "raw" }),
      node(
        totalLUK < 1000 ? "Sub-1000 curve" : "Over-1000 curve",
        drLUK,
        null,
        {
          fmt: "raw",
          note:
            totalLUK < 1000
              ? "(pow(" + totalLUK + "+1, 0.37)-1)/40"
              : "(" + totalLUK + "-1000)/(" + totalLUK + "+2500)*0.5+0.297",
        }
      ),
    ], { fmt: "raw" });
  },
};

// ============================================================================
// ===== FULL TotalStat CHAIN — 1:1 port of corgan-source stats.js ============
// ============================================================================
// Generic TotalStats computation for STR/AGI/WIS/LUK. Game formula
// (non-dungeon):
//   Math.floor(
//     AlchBubbles.Total{STAT} + talent(652) + Companions(8)
//     + (1 + pctPool/100) * (equipDN + flatBase + flatAdd)
//   )

import { treeResult, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { getLOG, formulaEval } from "../../../formulas";
import {
  equipOrderData,
  cauldronInfoData,
  optionsListData,
  stampLvData,
  skillLvData,
  obolNamesData,
  obolFamilyNames,
  obolMapsData,
  obolFamilyMaps,
  emmData,
  postOfficeData,
  numCharacters,
  charClassData,
  cardEquipData,
  buffsActiveData,
} from "../../../save/data";
import { ITEMS } from "../../data/game/items.js";
import { superBitType, eventShopOwned, ribbonBonusAt } from "../../../game-helpers";
import {
  isBubblePrismad,
  getPrismaBonusMult,
  sigil as sigilResolver,
} from "../w2/alchemy";
import { etcBonus as etcBonusResolver } from "./etcBonus";
import { pristine as pristineResolver } from "../w5/pristine";
import { shiny as shinyResolver } from "../w4/breeding";
import { arcade as arcadeResolver } from "../w2/arcade";
import { owl as owlResolver } from "../w1/owl";
import { companion as companionResolver } from "./companions";
import { talent as talentResolver, computeAllTalentLVz } from "./talent";
import { NAMETAG_TIER_SCALE } from "../../data/common/nametag";
import {
  StarSigns,
  PostOffUpgradeInfo,
  ClassFamilyBonuses,
  ClassAccountBonus,
  ClassPromotionChoices,
  AlchemyDescription,
  StatueInfo,
  ZenithMarket,
  MealINFO,
} from "../../data/game/customlists.js";
import { CARD_BONUS } from "../../data/common/cards";
import { IDforCardBonus } from "../../data/game/custommaps.js";
import { computeCardLv } from "./cards";
import { computeSeraphMulti } from "./starSign";
import { legendPTSbonus } from "../w7/spelunking";
import { achieveStatus } from "./achievement";
import { computeWinBonus } from "../w6/summoning";
import { mainframeBonus, charHasChip } from "../w4/lab";
import { goldFoodBonuses } from "./goldenFood";
import { votingBonusz } from "../w2/voting";
import { vaultUpgBonus } from "./vault";
import { pristineBon } from "../w5/pristine";
import { isExalted, computeStampDoublerSources } from "../w1/stamp";
import { artifactBase } from "../../data/w5/sailing";
import { cosmoUpgBase } from "../../data/w5/hole";
import { computeMeritocBonusz } from "../w7/meritoc";
import { bubbleParams } from "../../data/w2/alchemy";
import { guildBonusParams } from "../../data/common/guild";
import { equipSetBonus } from "../../data/common/equipment";
import { talentParams } from "../../data/common/talent";
import { farm as farmResolver } from "../w6/farming";
import { cookingMealMulti } from "./cooking";
import {
  galleryBonusMulti,
  hatrackBonusMulti,
  trophyTier,
} from "../w7/gallery";
import { COMPANION_BONUS } from "../../data/game-constants";

// Full ctx shape used by the ported chain. computeTotalStat passes this to
// every nested resolver (talent / etcBonus / farm / etc.).
type StatCtx = { saveData: SaveData; charIdx: number; activeCharIdx?: number };

// ==================== STAT CONFIG ====================
// Per-stat IDs. 1:1 with corgan-source STAT_CONFIG.
type StatCfg = {
  totalBubble: string;
  dnPctTalent: number;
  dnPctStampType: string;
  dn2PctTalent: number;
  pctTalent: number | null;
  pctBubble: string | null;
  etcPct: number;
  pristineIdx: number;
  flatTalent: number;
  guildTalent: number;
  stampBaseType: string;
  boxRewardsBase: string | null;
  etcFlat: number;
  olaShimmer: number;
  extraTalents: number[];
  extraTab2Talent: number | null;
  buffBonus: [number, number] | null;
  boxRewardsStat: string;
  famBonusIdx: number;
  starSignStat: string;
  cardType: number;
  flatTalent2: number | null;
  sigilIdx: number;
  shinyIdx: number;
  arcadeIdx: number;
  a4Bubble: string;
  questsTal618: boolean;
};

const STAT_CONFIG: Record<string, StatCfg> = {
  STR: {
    totalBubble: "TotalSTR",
    dnPctTalent: 96,
    dnPctStampType: "PctSTR",
    dn2PctTalent: 111,
    pctTalent: 143,
    pctBubble: "W8",
    etcPct: 57,
    pristineIdx: 4,
    flatTalent: 10,
    guildTalent: 51,
    stampBaseType: "BaseSTR",
    boxRewardsBase: null,
    etcFlat: 51,
    olaShimmer: 174,
    extraTalents: [98, 203],
    extraTab2Talent: 142,
    buffBonus: [94, 1],
    boxRewardsStat: "23b",
    famBonusIdx: 14,
    starSignStat: "STR",
    cardType: 9,
    flatTalent2: null,
    sigilIdx: 0,
    shinyIdx: 6,
    arcadeIdx: 19,
    a4Bubble: "W4",
    questsTal618: false,
  },
  AGI: {
    totalBubble: "TotalAGI",
    dnPctTalent: 276,
    dnPctStampType: "PctAGI",
    dn2PctTalent: 291,
    pctTalent: 368,
    pctBubble: "A9",
    etcPct: 25,
    pristineIdx: 1,
    flatTalent: 11,
    guildTalent: 52,
    stampBaseType: "BaseAGI",
    boxRewardsBase: null,
    etcFlat: 52,
    olaShimmer: 175,
    extraTalents: [278, 428],
    extraTab2Talent: 367,
    buffBonus: null,
    boxRewardsStat: "21b",
    famBonusIdx: 38,
    starSignStat: "AGI",
    cardType: 7,
    flatTalent2: null,
    sigilIdx: 1,
    shinyIdx: 7,
    arcadeIdx: 20,
    a4Bubble: "A4",
    questsTal618: false,
  },
  WIS: {
    totalBubble: "TotalWIS",
    dnPctTalent: 456,
    dnPctStampType: "PctWIS",
    dn2PctTalent: 486,
    pctTalent: 533,
    pctBubble: "M9",
    etcPct: 58,
    pristineIdx: 10,
    flatTalent: 12,
    guildTalent: 53,
    stampBaseType: "BaseWIS",
    boxRewardsBase: null,
    etcFlat: 53,
    olaShimmer: 176,
    extraTalents: [459, 593],
    extraTab2Talent: 532,
    buffBonus: null,
    boxRewardsStat: "22b",
    famBonusIdx: 62,
    starSignStat: "WIS",
    cardType: 5,
    flatTalent2: null,
    sigilIdx: 2,
    shinyIdx: 8,
    arcadeIdx: 21,
    a4Bubble: "M4",
    questsTal618: false,
  },
  LUK: {
    totalBubble: "TotalLUK",
    dnPctTalent: 21,
    dnPctStampType: "PctLUK",
    dn2PctTalent: 36,
    pctTalent: null,
    pctBubble: null,
    etcPct: 17,
    pristineIdx: 5,
    flatTalent: 13,
    guildTalent: 54,
    stampBaseType: "BaseLUK",
    boxRewardsBase: "15c",
    etcFlat: 54,
    olaShimmer: 177,
    extraTalents: [],
    extraTab2Talent: null,
    buffBonus: null,
    boxRewardsStat: "LUK",
    famBonusIdx: 4,
    starSignStat: "LUK",
    cardType: 2,
    flatTalent2: 23,
    sigilIdx: 3,
    shinyIdx: 9,
    arcadeIdx: 22,
    a4Bubble: "A4",
    questsTal618: true,
  },
};

// ==================== STAR SIGN STAT BONUSES ====================
function computeStarSignStatBonuses(
  statName: string,
  charIdx: number,
  saveData: SaveData
) {
  let flatTotal = 0,
    pctTotal = 0;
  const flatChildren: CorganNode[] = [],
    pctChildren: CorganNode[] = [];
  for (let i = 0; i < (StarSigns as any[]).length; i++) {
    const sign = (StarSigns as any[])[i];
    for (let e = 1; e <= 3; e++) {
      const eff = sign[e];
      if (!eff || eff === "_") continue;
      const m = String(eff).match(/^\+(\d+)(%?)_(.+)$/);
      if (!m) continue;
      const val = Number(m[1]);
      const isPct = m[2] === "%";
      const type = m[3];
      if (type === statName || type === "All_Stats" || type === "All_Stat") {
        if (isPct) {
          pctTotal += val;
          pctChildren.push(node(sign[0], val, null, { fmt: "raw" }));
        } else {
          flatTotal += val;
          flatChildren.push(node(sign[0], val, null, { fmt: "raw" }));
        }
      }
    }
  }
  const seraphMulti = computeSeraphMulti(charIdx, saveData);
  return {
    flat: {
      val: flatTotal * seraphMulti,
      baseVal: flatTotal,
      seraphMulti,
      children: flatChildren,
    },
    pct: {
      val: pctTotal * seraphMulti,
      baseVal: pctTotal,
      seraphMulti,
      children: pctChildren,
    },
  };
}

// ==================== CARD BONUS BY TYPE ====================
export function computeCardBonusByType(
  typeId: number,
  charIdx: number,
  saveData: SaveData
): { val: number; children: CorganNode[] } {
  const targetDesc = (IDforCardBonus as any)[String(typeId)];
  if (!targetDesc) return { val: 0, children: [] };
  const legend21 = legendPTSbonus(21, saveData);
  const legendMulti = 1 + legend21 / 100;
  const equipped = (cardEquipData as any)[charIdx] || [];
  let total = 0;
  const children: CorganNode[] = [];
  for (let i = 0; i < equipped.length; i++) {
    const cardKey = equipped[i];
    if (!cardKey || cardKey === "B") continue;
    const cb = (CARD_BONUS as any)[cardKey];
    if (!cb || cb.desc !== targetDesc) continue;
    const lv = computeCardLv(cardKey, saveData);
    if (lv <= 0) continue;
    const chipDouble =
      (i === 0 && charHasChip(charIdx, "card1")) ||
      (i === 7 && charHasChip(charIdx, "card2"))
        ? 2
        : 1;
    const contrib = chipDouble * lv * cb.val * legendMulti;
    total += contrib;
    children.push(
      node(cardKey + " Lv" + lv, contrib, null, {
        fmt: "raw",
        note: "per-star=" + cb.val + (chipDouble > 1 ? " ×2chip" : ""),
      })
    );
  }
  return { val: total, children };
}

// ==================== BOX REWARDS ====================
export function computeBoxReward(
  charIdx: number,
  key: string
): { val: number; children: CorganNode[] } {
  for (let boxIdx = 0; boxIdx < (PostOffUpgradeInfo as any[]).length; boxIdx++) {
    const box = (PostOffUpgradeInfo as any[])[boxIdx];
    for (let slot = 0; slot < 3; slot++) {
      if (box[16 + slot] !== key) continue;
      let pts = Number(((postOfficeData as any)[charIdx] || [])[boxIdx]) || 0;
      if (pts <= 0) return { val: 0, children: [] };
      if (slot === 1) pts -= Number(box[13]) || 0;
      if (slot === 2) pts -= Number(box[14]) || 0;
      pts = Math.round(pts);
      if (pts <= 0) return { val: 0, children: [] };
      const paramBase = 1 + slot * 4;
      const x1 = Number(box[paramBase]) || 0;
      const x2 = Number(box[paramBase + 1]) || 0;
      const formula = box[paramBase + 2];
      const val = formulaEval(formula, x1, x2, pts);
      return {
        val,
        children: [
          node(box[0] + " slot" + slot, val, null, {
            fmt: "raw",
            note: formula + "(" + x1 + "," + x2 + "," + pts + ")",
          }),
        ],
      };
    }
  }
  return { val: 0, children: [] };
}

// ==================== DREAM SHIMMER ====================
function computeDreamShimmer(saveData: SaveData): number {
  const sailing = saveData.sailingData;
  if (!sailing || !sailing[3]) return 1;
  const artTier = Number(sailing[3][31]) || 0;
  if (artTier <= 0) return 1;
  return Math.max(1, Math.min(4, 1 + artTier));
}

// ==================== EQUIP BASE STAT ====================
export function computeEquipBaseStat(
  charIdx: number,
  statName: string,
  saveData: SaveData
): { val: number; children: CorganNode[] } {
  let total = 0;
  const children: CorganNode[] = [];
  const eqData = (equipOrderData as any)[charIdx];
  if (!eqData) return { val: 0, children: [] };
  const emm = emmData && (emmData as any)[charIdx];
  const sp = saveData.spelunkData || [];
  const galleryOn =
    (sp[16] && sp[16].length > 0) || (sp[17] && sp[17].length > 0);
  const premhatOn = sp[46] && sp[46].length > 0;
  for (let row = 0; row < 2; row++) {
    const rr = eqData[row];
    if (!rr) continue;
    const maxSlots = row === 0 ? 16 : 8;
    const emmRow = emm && emm[row];
    for (let slot = 0; slot < maxSlots; slot++) {
      if (row === 0 && galleryOn && (slot === 10 || slot === 14)) continue;
      if (row === 0 && premhatOn && slot === 8) continue;
      const itemName = rr[slot] || rr[String(slot)];
      if (!itemName || itemName === "Blank") continue;
      const item = (ITEMS as any)[itemName];
      const baseStat = item ? Number(item[statName]) || 0 : 0;
      let stoneStat = 0;
      if (emmRow) {
        const emmSlot = emmRow[slot] || emmRow[String(slot)];
        if (emmSlot) stoneStat = Number(emmSlot[statName]) || 0;
      }
      const slotVal = baseStat + stoneStat;
      if (slotVal !== 0) {
        total += slotVal;
        children.push(
          node("R" + row + "S" + slot + " " + itemName, slotVal, null, {
            fmt: "raw",
            note: "base=" + baseStat + " stone=" + stoneStat,
          })
        );
      }
    }
  }
  return { val: total, children };
}

// ==================== GALLERY BASE STAT ====================
export function computeGalleryBaseStat(
  charIdx: number,
  ctx: StatCtx,
  statName: string
): { val: number; children: CorganNode[] } {
  const saveData = ctx.saveData;
  let total = 0;
  const children: CorganNode[] = [];
  const sp = saveData.spelunkData || [];
  const gbm = galleryBonusMulti(saveData).val;
  const hbm = hatrackBonusMulti(saveData).val;

  // Trophy base stat
  const trophySlots = sp[16] || [];
  let trophyTotal = 0;
  const trophyCh: CorganNode[] = [];
  for (let i = 0; i < trophySlots.length; i++) {
    const trophyId = Number(trophySlots[i]) || 0;
    if (trophyId < 1) continue;
    const tItem = (ITEMS as any)["Trophy" + trophyId];
    const tStat = tItem ? Number(tItem[statName]) || 0 : 0;
    if (tStat === 0) continue;
    const tier = trophyTier(i, saveData);
    const val = tier * gbm * tStat;
    trophyTotal += val;
    trophyCh.push(
      node("Trophy" + trophyId + " slot" + i, val, null, {
        fmt: "raw",
        note: "base=" + tStat + " tier=" + tier,
      })
    );
  }
  if (trophyTotal > 0) {
    children.push(node("Trophy Base " + statName, trophyTotal, trophyCh, { fmt: "raw" }));
    total += trophyTotal;
  }

  // Nametag base stat
  const nametagLevels = sp[17] || [];
  let nametagTotal = 0;
  const nametagCh: CorganNode[] = [];
  for (let ni = 0; ni < nametagLevels.length; ni++) {
    const nlv = Number(nametagLevels[ni]) || 0;
    if (nlv < 1) continue;
    const nItemKey = ni === 6 ? "EquipmentNametag6b" : "EquipmentNametag" + ni;
    const nItem = (ITEMS as any)[nItemKey];
    if (!nItem) continue;
    const nStat = Number(nItem[statName]) || 0;
    if (nStat === 0) continue;
    const ntier =
      NAMETAG_TIER_SCALE[Math.min(NAMETAG_TIER_SCALE.length - 1, nlv - 1)];
    const nval = ntier * gbm * nStat;
    nametagTotal += nval;
    nametagCh.push(
      node("Nametag" + (ni + 1) + " Lv" + nlv, nval, null, {
        fmt: "raw",
        note: "base=" + nStat + " tier=" + ntier,
      })
    );
  }
  if (nametagTotal > 0) {
    children.push(node("Nametag Base " + statName, nametagTotal, nametagCh, { fmt: "raw" }));
    total += nametagTotal;
  }

  // Premhat base stat
  const hats = sp[46] || [];
  let premhatTotal = 0;
  const premhatCh: CorganNode[] = [];
  for (let hi = 0; hi < hats.length; hi++) {
    const hatName = hats[hi];
    if (!hatName || typeof hatName !== "string") continue;
    const hItem = (ITEMS as any)[hatName];
    const hStat = hItem ? Number(hItem[statName]) || 0 : 0;
    if (hStat === 0) continue;
    const hval = hbm * hStat;
    premhatTotal += hval;
    premhatCh.push(node(hatName, hval, null, { fmt: "raw", note: "base=" + hStat }));
  }
  if (premhatTotal > 0) {
    children.push(node("Premhat Base " + statName, premhatTotal, premhatCh, { fmt: "raw" }));
    total += premhatTotal;
  }

  return { val: total, children };
}

// ==================== OBOL BASE STAT ====================
export function computeObolBaseStat(
  charIdx: number,
  statName: string
): { val: number; children: CorganNode[] } {
  let total = 0;
  const children: CorganNode[] = [];
  const pNames = obolNamesData && (obolNamesData as any)[charIdx];
  const pMaps = obolMapsData && (obolMapsData as any)[charIdx];
  if (pNames) {
    for (let i = 0; i < pNames.length; i++) {
      const on = pNames[i];
      if (!on || on === "Blank" || on === "Null") continue;
      const oItem = (ITEMS as any)[on];
      const oStat = oItem ? Number(oItem[statName]) || 0 : 0;
      const mapBonus = pMaps && pMaps[i] ? Number(pMaps[i][statName]) || 0 : 0;
      const slotTotal = oStat + mapBonus;
      if (slotTotal > 0) {
        total += slotTotal;
        children.push(node("Personal " + on, slotTotal, null, { fmt: "raw" }));
      }
    }
  }
  const fNames = obolFamilyNames;
  const fMaps = obolFamilyMaps;
  if (fNames) {
    for (let j = 0; j < (fNames as any[]).length; j++) {
      const fn = (fNames as any[])[j];
      if (!fn || fn === "Blank" || fn === "Null") continue;
      const fItem = (ITEMS as any)[fn];
      const fStat = fItem ? Number(fItem[statName]) || 0 : 0;
      const fMapBonus =
        fMaps && (fMaps as any)[j] ? Number((fMaps as any)[j][statName]) || 0 : 0;
      const fSlotTotal = fStat + fMapBonus;
      if (fSlotTotal > 0) {
        total += fSlotTotal;
        children.push(node("Family " + fn, fSlotTotal, null, { fmt: "raw" }));
      }
    }
  }
  return { val: total, children };
}

// ==================== STAMP BONUS BY TYPE ====================
const CAT_LETTER = ["A", "B", "C"];

function computeStampBonusOfTypeX(
  type: string,
  saveData: SaveData
): { val: number; children: CorganNode[] } {
  let total = 0;
  const children: CorganNode[] = [];
  const labDouble = mainframeBonus(7, saveData) === 2 ? 2 : 1;
  const prist17 = pristineBon(17, saveData);
  const pristineMulti = prist17 > 0 ? 1 + prist17 / 100 : 1;
  const doublerInfo = computeStampDoublerSources(saveData);
  for (let cat = 0; cat < 3; cat++) {
    const lvMap = (stampLvData as any)[cat] || (stampLvData as any)[String(cat)];
    if (!lvMap) continue;
    for (let idx = 0; idx < 60; idx++) {
      const lv = Number(lvMap[idx] || lvMap[String(idx)]) || 0;
      if (lv <= 0) continue;
      const stampName = "Stamp" + CAT_LETTER[cat] + (idx + 1);
      const item = (ITEMS as any)[stampName];
      if (!item || !item.desc_line1) continue;
      const parts = String(item.desc_line1).split(",");
      if (parts[0] !== type) continue;
      const formula = parts[1];
      const x1 = Number(parts[2]) || 0;
      const x2 = Number(parts[3]) || 0;
      const baseVal = formulaEval(formula, x1, x2, lv);
      const exalted = isExalted(cat, idx, saveData);
      const exaltedMult = exalted ? 1 + doublerInfo.total / 100 : 1;
      let val = baseVal * exaltedMult;
      if (cat < 2) {
        val = val * labDouble * pristineMulti;
      }
      total += val;
      let stampNote = formula + "(" + x1 + "," + x2 + "," + lv + ")";
      if (exalted) stampNote += " exalted×" + exaltedMult.toFixed(2);
      if (cat < 2 && labDouble > 1) stampNote += " lab×" + labDouble;
      if (cat < 2 && pristineMulti > 1)
        stampNote += " prist×" + pristineMulti.toFixed(2);
      children.push(
        node(stampName + " Lv" + lv, val, null, { fmt: "raw", note: stampNote })
      );
    }
  }
  return { val: total, children };
}

// ==================== ALCHEMY BUBBLE ====================
type BubbleKey = {
  cauldron: number;
  index: number;
  slab?: boolean;
  tome?: boolean;
};
const BUBBLE_KEYS: Record<string, BubbleKey> = {
  TotalLUK: { cauldron: 3, index: 0, slab: false },
  TotalSTR: { cauldron: 0, index: 0, slab: false },
  TotalAGI: { cauldron: 1, index: 0, slab: false },
  TotalWIS: { cauldron: 2, index: 0, slab: false },
  W4: { cauldron: 0, index: 23, slab: true },
  W8: { cauldron: 0, index: 27, tome: true },
  A4: { cauldron: 1, index: 23, slab: true },
  A9: { cauldron: 1, index: 28, tome: true },
  M4: { cauldron: 2, index: 23, slab: true },
  M9: { cauldron: 2, index: 28, tome: true },
};

function getPasszMult(
  cauldron: number,
  charIdx: number,
  saveData: SaveData
): { val: number; children: CorganNode[] } {
  if (cauldron === 3) return { val: 1, children: [] };
  const charClass = Number((charClassData as any)[charIdx] || 0);
  if (charClass <= 6) return { val: 1, children: [] };
  let match = false;
  if (cauldron === 0 && charClass < 18) match = true;
  else if (cauldron === 1 && charClass >= 18 && charClass < 30) match = true;
  else if (cauldron === 2 && charClass >= 30 && charClass < 42) match = true;
  if (!match) return { val: 1, children: [] };
  const passzParams = bubbleParams(cauldron, 1);
  if (!passzParams) return { val: 1, children: [] };
  const passzLv = Number(
    ((cauldronInfoData as any) &&
      (cauldronInfoData as any)[cauldron] &&
      (cauldronInfoData as any)[cauldron][1]) ||
      0
  );
  if (passzLv <= 0) return { val: 1, children: [] };
  const passzBase = formulaEval(
    (passzParams as any).formula,
    (passzParams as any).x1,
    (passzParams as any).x2,
    passzLv
  );
  const passzPrisma = isBubblePrismad(cauldron, 1)
    ? Math.max(1, getPrismaBonusMult(saveData))
    : 1;
  const passzVal = Math.max(1, passzBase * passzPrisma);
  return {
    val: passzVal,
    children: [
      node(
        (passzParams as any).name,
        passzVal,
        [
          node("Level", passzLv, null, { fmt: "raw" }),
          node("Base", passzBase, null, { fmt: "raw" }),
        ].concat(
          passzPrisma > 1 ? [node("Prisma", passzPrisma, null, { fmt: "x" })] : []
        ),
        { fmt: "x" }
      ),
    ],
  };
}

const MULTI_AFFECTED: Record<number, number[]> = {
  0: [0, 2, 4, 7, 14],
  1: [0, 6, 9, 12, 14],
  2: [0, 2, 6, 12, 14],
};
const MULTI_BUBBLE_INDEX = 16;

function getMultiBubbleMult(
  cauldron: number,
  bubbleIndex: number,
  saveData: SaveData
): { val: number; children: CorganNode[] } {
  const affected = MULTI_AFFECTED[cauldron];
  if (!affected || affected.indexOf(bubbleIndex) === -1)
    return { val: 1, children: [] };
  const multiParams = bubbleParams(cauldron, MULTI_BUBBLE_INDEX);
  if (!multiParams) return { val: 1, children: [] };
  const multiLv = Number(
    ((cauldronInfoData as any) &&
      (cauldronInfoData as any)[cauldron] &&
      (cauldronInfoData as any)[cauldron][MULTI_BUBBLE_INDEX]) ||
      0
  );
  if (multiLv <= 0) return { val: 1, children: [] };
  const multiBase = formulaEval(
    (multiParams as any).formula,
    (multiParams as any).x1,
    (multiParams as any).x2,
    multiLv
  );
  const multiPrisma = isBubblePrismad(cauldron, MULTI_BUBBLE_INDEX)
    ? Math.max(1, getPrismaBonusMult(saveData))
    : 1;
  const multiVal = Math.max(1, multiBase * multiPrisma);
  return {
    val: multiVal,
    children: [
      node(
        (multiParams as any).name + " Multi",
        multiVal,
        [
          node("Level", multiLv, null, { fmt: "raw" }),
          node("Base", multiBase, null, { fmt: "raw" }),
        ].concat(
          multiPrisma > 1 ? [node("Prisma", multiPrisma, null, { fmt: "x" })] : []
        ),
        { fmt: "x" }
      ),
    ],
  };
}

function computeAlchBubble(
  bonusType: string,
  charIdx: number | null,
  saveData: SaveData
): { val: number; children: CorganNode[]; name?: string } {
  const bk = BUBBLE_KEYS[bonusType];
  if (!bk) return { val: 0, children: [] };
  const params: any = bubbleParams(bk.cauldron, bk.index);
  if (!params) return { val: 0, children: [] };
  params.slab = bk.slab;
  params.tome = bk.tome;
  const lv = Number(
    ((cauldronInfoData as any) &&
      (cauldronInfoData as any)[params.cauldron] &&
      (cauldronInfoData as any)[params.cauldron][params.index]) ||
      0
  );
  if (lv <= 0) return { val: 0, children: [] };
  const baseVal = formulaEval(params.formula, params.x1, params.x2, lv);
  const isPrisma = isBubblePrismad(params.cauldron, params.index);
  const prismaMult = isPrisma ? Math.max(1, getPrismaBonusMult(saveData)) : 1;
  let slabMult = 1;
  if (params.slab) {
    const slabCount = (saveData.cards1Data && saveData.cards1Data.length) || 0;
    slabMult = Math.floor(slabCount / 100);
    if (slabMult < 1) slabMult = 1;
  }
  let tomeMult = 1;
  let tomeExtraMult = 1;
  if (params.tome) {
    const tomePoints = saveData.totalTomePoints || 0;
    tomeMult = Math.max(0, Math.floor((tomePoints - 5000) / 2000));
    if (tomeMult < 1) tomeMult = 1;
    const g17 = Number((saveData.grimoireData && saveData.grimoireData[17]) || 0);
    const trollSet =
      String((optionsListData && (optionsListData as any)[379]) || "").indexOf(
        "TROLL_SET"
      ) !== -1
        ? equipSetBonus("TROLL_SET")
        : 0;
    tomeExtraMult = 1 + (g17 + trollSet) / 100;
  }
  const passz =
    charIdx != null && bk.index > 0
      ? getPasszMult(bk.cauldron, charIdx, saveData)
      : { val: 1, children: [] as CorganNode[] };
  const passzMult = passz.val;
  let val = baseVal * prismaMult * passzMult * slabMult * tomeMult * tomeExtraMult;
  const multi = getMultiBubbleMult(bk.cauldron, bk.index, saveData);
  val *= multi.val;
  let children: CorganNode[] = [
    node("Level", lv, null, { fmt: "raw" }),
    node("Base", baseVal, null, { fmt: "raw" }),
  ];
  if (isPrisma) children.push(node("Prisma Multi", prismaMult, null, { fmt: "x" }));
  if (passzMult > 1) children = children.concat(passz.children);
  if (params.slab && slabMult > 1)
    children.push(
      node("Slab Multi", slabMult, null, { fmt: "x", note: "floor(slabItems/100)" })
    );
  if (params.tome && tomeMult > 1)
    children.push(
      node("Tome Multi", tomeMult, null, {
        fmt: "x",
        note: "floor((tome-5000)/2000)",
      })
    );
  if (params.tome && tomeExtraMult > 1)
    children.push(
      node("Tome Bonus", tomeExtraMult, null, {
        fmt: "x",
        note: "GrimoireUpg(17)+TrollSet",
      })
    );
  if (multi.val > 1) children = children.concat(multi.children);
  return { val, children, name: params.name };
}

// ==================== FAMILY BONUS ====================
const _famParent: Record<number, number> = {};
for (let _fci = 0; _fci < (ClassPromotionChoices as any[]).length; _fci++) {
  const _fch = (ClassPromotionChoices as any[])[_fci];
  if (!_fch || _fch[0] === "Na") continue;
  for (let _fj = 0; _fj < _fch.length; _fj++) _famParent[Number(_fch[_fj])] = _fci;
}
_famParent[2] = 1; // Journeyman -> Beginner hidden promotion

function returnClasses(classId: number): number[] {
  if (classId < 6) {
    const chain: number[] = [];
    for (let i = 1; i <= classId; i++) chain.push(i);
    return chain;
  }
  const chain = [classId];
  let cur: number | undefined = _famParent[classId];
  while (cur !== undefined) {
    chain.unshift(cur);
    cur = _famParent[cur];
  }
  return chain;
}

export function computeFamBonusQTYs(
  activeCharIdx: number,
  saveData: SaveData
): Record<number, number> {
  let rawLv144 = 0;
  if (activeCharIdx >= 0) {
    const sl144 = (skillLvData as any)[activeCharIdx] || {};
    rawLv144 = Number(sl144[144] || sl144["144"]) || 0;
  }
  const result: Record<number, number> = {};
  for (let ci = 0; ci < numCharacters; ci++) {
    const classId = (charClassData as any)[ci] || 0;
    if (classId <= 0) continue;
    const playerLv = Number(
      (saveData.lv0AllData &&
        saveData.lv0AllData[ci] &&
        saveData.lv0AllData[ci][0]) ||
        0
    );
    if (playerLv <= 0) continue;
    const chain = returnClasses(classId);
    for (let c = 0; c < chain.length; c++) {
      const clsIdx = chain[c];
      const cfb = (ClassFamilyBonuses as any[])[clsIdx];
      const cab = (ClassAccountBonus as any[])[clsIdx];
      if (!cfb || !cab) continue;
      const lvOffset = Number(cab[1]) || 0;
      const effectiveLv = Math.max(0, Math.round(playerLv - lvOffset));
      for (let type = 0; type < 2; type++) {
        const pb = 1 + 3 * type;
        const formula = cfb[pb + 2];
        if (!formula || formula === "txt" || formula === "_") continue;
        const x1 = Number(cfb[pb]) || 0;
        const x2 = Number(cfb[pb + 1]) || 0;
        const bonus = formulaEval(formula, x1, x2, effectiveLv);
        const key = Math.round(2 * clsIdx + type);
        if (!result[key] || bonus > result[key]) {
          result[key] = bonus;
          if (rawLv144 > 0 && ci === activeCharIdx) {
            const bonus144 = computeAllTalentLVz(
              144,
              activeCharIdx,
              { partialFamBonusMap: result },
              saveData
            );
            const t144: any = talentParams(144);
            const tal144val = formulaEval(
              t144.formula,
              t144.x1,
              t144.x2,
              rawLv144 + bonus144
            );
            result[key] = bonus * (1 + tal144val / 100);
          }
        }
      }
    }
  }
  return result;
}

// ==================== ALL STAT PCT ====================
function computeAllStatPCT(
  charIdx: number,
  ctx: StatCtx
): { val: number; rawSum: number; children: CorganNode[]; subMissing: string[] } {
  const saveData = ctx.saveData;
  let sum = 0;
  const children: CorganNode[] = [];
  const subMissing: string[] = [];

  function addSub(name: string, val: number, ch?: CorganNode[] | null) {
    sum += val;
    children.push(node(name, val, ch || null, { fmt: "raw" }));
  }

  // 1. AlchVials.AllStatPCT
  let vialAllStatPCT = 0;
  const vialCh: CorganNode[] = [];
  const vials = (cauldronInfoData as any)[4] || [];
  for (let vi = 0; vi < (AlchemyDescription as any)[4].length; vi++) {
    const vDesc = (AlchemyDescription as any)[4][vi];
    if (vDesc[11] !== "AllStatPCT") continue;
    const vialLv = Number(vials[vi]) || 0;
    if (vialLv <= 0) continue;
    const vialBase = formulaEval(
      vDesc[3],
      Number(vDesc[1]) || 0,
      Number(vDesc[2]) || 0,
      vialLv
    );
    const riftActive = Number(saveData.riftData && saveData.riftData[0]) > 34;
    const vub42 = vaultUpgBonus(42, saveData);
    let maxLvVials = 0;
    if (riftActive) {
      for (let rvi = 0; rvi < vials.length; rvi++) {
        if ((Number(vials[rvi]) || 0) >= 13) maxLvVials++;
      }
    }
    const riftVialBonus = riftActive ? 2 * maxLvVials : 0;
    const dNzz = riftVialBonus + vub42;
    const mf10lab = mainframeBonus(10, saveData) === 2 ? 2 : 1;
    const meritoc20 = computeMeritocBonusz(20, saveData);
    vialAllStatPCT +=
      mf10lab * (1 + dNzz / 100) * (1 + meritoc20 / 100) * vialBase;
    vialCh.push(
      node(
        vDesc[0] + " Lv" + vialLv,
        vialAllStatPCT,
        [
          node("Base", vialBase, null, {
            fmt: "raw",
            note: vDesc[3] + "(" + vDesc[1] + "," + vDesc[2] + "," + vialLv + ")",
          }),
          node("Lab x2", mf10lab, null, { fmt: "x" }),
          node(label("Vault", 42), vub42, null, { fmt: "raw", note: "DNzz=" + dNzz }),
          node(label("Meritoc", 20), 1 + meritoc20 / 100, null, { fmt: "x" }),
        ],
        { fmt: "raw" }
      )
    );
  }
  addSub("AlchVials.AllStatPCT", vialAllStatPCT, vialCh.length ? vialCh : null);

  // 2. 15 * Companions(0) * CosmoBonusQTY(2,0)
  const comp0 =
    saveData.companionIds && saveData.companionIds.has(0) ? 1 : 0;
  const hd = saveData.holesData || [];
  const cosmo20Lv = Number((hd[6] && hd[6][0]) || 0);
  const cosmo20base = cosmoUpgBase(2, 0);
  const cosmo20 = Math.floor(cosmo20base * cosmo20Lv);
  const compCosmo = (COMPANION_BONUS as any)[0] * comp0 * cosmo20;
  addSub(
    (COMPANION_BONUS as any)[0] + "*Comp(0)*Cosmo(2,0)",
    compCosmo,
    [
      node(label("Companion", 0, " owned"), comp0, null, { fmt: "raw" }),
      node("CosmoBonusQTY(2,0)", cosmo20, null, {
        fmt: "raw",
        note: "base=" + cosmo20base + " lv=" + cosmo20Lv,
      }),
    ]
  );

  // 3. MainframeBonus(104)
  const mf104 = mainframeBonus(104, saveData);
  addSub("MainframeBonus(104)", mf104);

  // 4. StampBonusOfTypeX("AllStatPct")
  const stampAllStatPct = computeStampBonusOfTypeX("AllStatPct", saveData);
  addSub("Stamp AllStatPct", stampAllStatPct.val, stampAllStatPct.children);

  // 5. CardBonusREAL(82)
  const card82 = computeCardBonusByType(82, charIdx, saveData);
  addSub("CardBonusREAL(82)", card82.val, card82.children);

  // 6. Summoning WinBonus(18)
  const wb18 = computeWinBonus(18, null, saveData);
  addSub("WinBonus(18)", wb18 as any);

  // 7. FamBonusQTYs[72]
  const famMap = computeFamBonusQTYs(charIdx, saveData);
  const fam72 = famMap[72] || 0;
  addSub("FamBonusQTYs[72]", fam72);

  // 8. Sailing ArtifactBonus(28)
  const sailing = saveData.sailingData;
  const art28tier = Number((sailing && sailing[3] && sailing[3][28]) || 0);
  const art28val = art28tier > 0 ? artifactBase(28) * art28tier : 0;
  addSub(
    "ArtifactBonus(28)",
    art28val,
    art28tier > 0
      ? [
          node("Tier", art28tier, null, { fmt: "raw" }),
          node("Base", artifactBase(28), null, { fmt: "raw" }),
        ]
      : null
  );

  // 9. GoldFoodBonuses("AllStatz")
  const gfoodAllStatz = goldFoodBonuses("AllStatz", charIdx, undefined, saveData);
  addSub("GoldFood AllStatz", gfoodAllStatz.total);

  // 10. AchieveStatus(309)
  addSub("AchieveStatus(309)", achieveStatus(309, saveData));

  // 11. min(15, getLOG(OLA[172]) * GetTalentNumber(1, 653))
  const ola172 = Number((optionsListData && (optionsListData as any)[172]) || 0);
  const logOla172 = ola172 > 0 ? getLOG(ola172) : 0;
  const tal653node = talentResolver.resolve(653, ctx);
  const tal653eff = tal653node.val;
  const tal653val = Math.min(15, logOla172 * tal653eff);
  addSub("min(15,LOG(OLA172)*tal653)", tal653val, [
    node("OLA[172]", ola172, null, { fmt: "raw" }),
    node("LOG(OLA172)", logOla172, null, { fmt: "raw" }),
    tal653node,
  ]);

  // 12. AchieveStatus(362)
  addSub("AchieveStatus(362)", achieveStatus(362, saveData));

  // 13. 10 * floor((98 + OLA[232]) / 100)
  const ola232 = Number((optionsListData && (optionsListData as any)[232]) || 0);
  const ola232val = 10 * Math.floor((98 + ola232) / 100);
  addSub("10*floor((98+OLA232)/100)", ola232val, [
    node("OLA[232]", ola232, null, { fmt: "raw" }),
  ]);

  // 14. FarmingStuffs("LankRankUpgBonus", 19, 0)
  const farmRank19 = farmResolver.resolve("rank19" as any, ctx as any);
  addSub("FarmRankUpg(19)", farmRank19.val, farmRank19.children);

  // 15. Summoning VotingBonusz(2)
  const vote2 = votingBonusz(2, undefined, saveData);
  addSub("VotingBonusz(2)", vote2);

  // 16. SetBonus("MARBIGLASS_SET")
  const perma379 = String((optionsListData && (optionsListData as any)[379]) || "");
  const marbiVal =
    perma379.indexOf("MARBIGLASS_SET") !== -1 ? equipSetBonus("MARBIGLASS_SET") : 0;
  addSub("SetBonus(MARBIGLASS)", marbiVal);

  const raw = 0.1 * Math.floor(10 * sum);
  return { val: raw, rawSum: sum, children, subMissing };
}

// ==================== MAIN: computeTotalStat ====================
export type TotalStatResult = {
  computed: number;
  missingCount: number;
  missingNames: string[];
  tree: CorganNode;
};

export function computeTotalStat(
  statName: string,
  charIdx: number,
  ctx: StatCtx
): TotalStatResult {
  const saveData = ctx.saveData;
  const cfg = STAT_CONFIG[statName];
  if (!cfg)
    return {
      computed: 0,
      missingCount: 1,
      missingNames: ["Unknown stat: " + statName],
      tree: node("Total " + statName, 0),
    };

  const tracked = { computed: 0, missing: 0, missingNames: [] as string[] };
  function addComputed(val: number) {
    tracked.computed += val;
    return val;
  }

  // ==================== EQUIP DN ====================
  const equipBase = computeEquipBaseStat(charIdx, statName, saveData);
  const equipBaseStat = addComputed(equipBase.val);

  const galleryBase = computeGalleryBaseStat(charIdx, ctx, statName);
  const galleryBaseStat = addComputed(galleryBase.val);

  const dnTalentVal = talentResolver.resolve(cfg.dnPctTalent, ctx).val;
  addComputed(dnTalentVal);
  const stampPctStat = computeStampBonusOfTypeX(cfg.dnPctStampType, saveData);
  addComputed(stampPctStat.val);
  const equipPctMult = 1 + (dnTalentVal + stampPctStat.val) / 100;
  const totalStatsDN_main = (equipBaseStat + galleryBaseStat) * equipPctMult;

  const obolBase = computeObolBaseStat(charIdx, statName);
  const obolBaseStat = addComputed(obolBase.val);
  const dn2TalentVal = talentResolver.resolve(cfg.dn2PctTalent, ctx).val;
  addComputed(dn2TalentVal);
  const superBit2 = superBitType(2, saveData.gamingData && saveData.gamingData[12])
    ? 1
    : 0;
  const obolPctMult = 1 + (dn2TalentVal + 40 * superBit2) / 100;
  const totalStatsDN2 = obolBaseStat * obolPctMult;

  const totalStatsDN = totalStatsDN_main + totalStatsDN2;

  const equipDNchildren = [
    node("Equipment Base " + statName, equipBaseStat, equipBase.children, { fmt: "raw" }),
    node("Gallery Base " + statName, galleryBaseStat, galleryBase.children, { fmt: "raw" }),
    node(
      "DN Pct Mult",
      equipPctMult,
      [
        node("Talent " + cfg.dnPctTalent, dnTalentVal, null, { fmt: "raw" }),
        node("Stamp " + cfg.dnPctStampType, stampPctStat.val, stampPctStat.children, {
          fmt: "raw",
        }),
      ],
      { fmt: "x" }
    ),
    node("Obol Base " + statName, obolBaseStat, obolBase.children, { fmt: "raw" }),
    node(
      "Obol Pct Mult",
      obolPctMult,
      [
        node("Talent " + cfg.dn2PctTalent, dn2TalentVal, null, { fmt: "raw" }),
        node(label("Super Bit", 2), 40 * superBit2, null, { fmt: "raw" }),
      ],
      { fmt: "x" }
    ),
  ];

  // ==================== PCT POOL ====================
  const etcPct = etcBonusResolver.resolve(cfg.etcPct, ctx).val;
  addComputed(etcPct);
  const etcB46 = etcBonusResolver.resolve(46, ctx).val;
  addComputed(etcB46);
  const allStatPCTResult = computeAllStatPCT(charIdx, ctx);
  const allStatPCT = allStatPCTResult.val;
  addComputed(allStatPCT);
  for (let _asmi = 0; _asmi < allStatPCTResult.subMissing.length; _asmi++) {
    tracked.missing++;
    tracked.missingNames.push("AllStatPCT." + allStatPCTResult.subMissing[_asmi]);
  }
  const pristineVal = pristineResolver.resolve(cfg.pristineIdx, ctx).val;
  addComputed(pristineVal);

  const signBonuses = computeStarSignStatBonuses(statName, charIdx, saveData);
  const starSignPct = signBonuses.pct.val;
  addComputed(starSignPct);

  let pctTalentVal = 0;
  if (cfg.pctTalent) {
    pctTalentVal = talentResolver.resolve(cfg.pctTalent, ctx).val;
    addComputed(pctTalentVal);
  }

  let pctBubbleVal = 0;
  if (cfg.pctBubble) {
    const pctBbl = computeAlchBubble(cfg.pctBubble, charIdx, saveData);
    pctBubbleVal = pctBbl.val;
    addComputed(pctBubbleVal);
  }

  const pctSum =
    pctTalentVal + etcPct + etcB46 + allStatPCT + pristineVal + starSignPct + pctBubbleVal;
  const pctMult = 1 + pctSum / 100;

  const pctChildren: CorganNode[] = [];
  if (cfg.pctTalent)
    pctChildren.push(node("Talent " + cfg.pctTalent, pctTalentVal, null, { fmt: "raw" }));
  pctChildren.push(
    node("EtcBonuses(" + cfg.etcPct + ") %_" + statName, etcPct, null, { fmt: "raw" }),
    node("EtcBonuses(46) %_ALL_STATS", etcB46, null, { fmt: "raw" }),
    node("AllStatPCT", allStatPCT, allStatPCTResult.children, {
      fmt: "raw",
      note: "0.1*floor(10*" + allStatPCTResult.rawSum.toFixed(1) + ")",
    }),
    node("Pristine(" + cfg.pristineIdx + ")", pristineVal, null, { fmt: "raw" }),
    node(
      "StarSigns.pct" + statName,
      starSignPct,
      signBonuses.pct.children.length
        ? [
            node("Base Sum", signBonuses.pct.baseVal, signBonuses.pct.children, { fmt: "raw" }),
            node("Seraph Multi", signBonuses.pct.seraphMulti, null, { fmt: "x" }),
          ]
        : null,
      { fmt: "raw" }
    )
  );
  if (cfg.pctBubble)
    pctChildren.push(node("AlchBubble " + cfg.pctBubble, pctBubbleVal, null, { fmt: "raw" }));

  // ==================== FLAT BASE POOL ====================
  const flatTalentVal = talentResolver.resolve(cfg.flatTalent, ctx).val;
  addComputed(flatTalentVal);

  const guildMax = talentResolver.resolve(cfg.guildTalent, ctx, { mode: "max" });
  const guildVal = guildMax.val;
  addComputed(guildVal);

  const stampBase = computeStampBonusOfTypeX(cfg.stampBaseType, saveData);
  addComputed(stampBase.val);

  const boxBase = cfg.boxRewardsBase
    ? computeBoxReward(charIdx, cfg.boxRewardsBase)
    : { val: 0, children: [] as CorganNode[] };
  addComputed(boxBase.val);

  const etcFlat = etcBonusResolver.resolve(cfg.etcFlat, ctx).val;
  addComputed(etcFlat);

  const olaVal = Number((optionsListData && (optionsListData as any)[cfg.olaShimmer])) || 0;
  const dreamShimmer = computeDreamShimmer(saveData);
  const shimmerVal = olaVal * dreamShimmer;
  addComputed(shimmerVal);

  let extraTalentSum = 0;
  const extraTalentCh: CorganNode[] = [];
  if (cfg.extraTalents) {
    for (let et = 0; et < cfg.extraTalents.length; et++) {
      const etv = talentResolver.resolve(cfg.extraTalents[et], ctx).val;
      extraTalentSum += etv;
      addComputed(etv);
      extraTalentCh.push(node("Talent " + cfg.extraTalents[et], etv, null, { fmt: "raw" }));
    }
  }
  if (cfg.extraTab2Talent) {
    const et2v = talentResolver.resolve(cfg.extraTab2Talent, ctx, { tab: 2 }).val;
    extraTalentSum += et2v;
    addComputed(et2v);
    extraTalentCh.push(node("Tab2 Talent " + cfg.extraTab2Talent, et2v, null, { fmt: "raw" }));
  }

  // GetBuffBonuses (STR only: buff 94)
  let buffVal = 0;
  if (cfg.buffBonus) {
    const buffId = cfg.buffBonus[0],
      buffTab = cfg.buffBonus[1];
    const charBuffs = (buffsActiveData as any)[charIdx] || [];
    let buffActive = false;
    for (let bi = 0; bi < charBuffs.length; bi++) {
      if (Number(charBuffs[bi][0] || charBuffs[bi]["0"]) === buffId) {
        buffActive = true;
        break;
      }
    }
    if (buffActive) {
      buffVal = talentResolver.resolve(buffId, ctx, { tab: buffTab }).val;
    }
  }

  let flatBaseSum = flatTalentVal + guildVal + stampBase.val + etcFlat;
  if (statName === "LUK") flatBaseSum += boxBase.val + shimmerVal;

  const flatBaseChildren: CorganNode[] = [
    node("Talent " + cfg.flatTalent, flatTalentVal, null, { fmt: "raw" }),
    node("Guild (max tal " + cfg.guildTalent + ")", guildVal, null, { fmt: "raw" }),
    node("Stamp " + cfg.stampBaseType, stampBase.val, stampBase.children, { fmt: "raw" }),
    node("EtcBonuses(" + cfg.etcFlat + ") _" + statName, etcFlat, null, { fmt: "raw" }),
  ];
  if (statName === "LUK") {
    flatBaseChildren.push(
      node("BoxRewards[" + cfg.boxRewardsBase + "]", boxBase.val, boxBase.children, { fmt: "raw" }),
      node(
        "OLA[" + cfg.olaShimmer + "]*Shimmer",
        shimmerVal,
        [
          node("OLA Count", olaVal, null, { fmt: "raw" }),
          node("DreamShimmer", dreamShimmer, null, { fmt: "x" }),
        ],
        { fmt: "raw" }
      )
    );
  }

  // ==================== FLAT ADD POOL ====================
  const boxStat = cfg.boxRewardsStat
    ? computeBoxReward(charIdx, cfg.boxRewardsStat)
    : { val: 0, children: [] as CorganNode[] };
  addComputed(boxStat.val);

  const famMap = computeFamBonusQTYs(charIdx, saveData);
  const famBonus = famMap[cfg.famBonusIdx] || 0;
  addComputed(famBonus);

  const starSignFlat = signBonuses.flat.val;
  addComputed(starSignFlat);

  let questsTal618 = 0;
  let tal618eff = 0;
  if (cfg.questsTal618) {
    const totalQC = saveData.totalQuestsComplete || 0;
    const tal618node = talentResolver.resolve(618, ctx);
    tal618eff = tal618node.val;
    questsTal618 = Math.min(totalQC, tal618eff);
    addComputed(questsTal618);
  }

  let tal620raw = 0;
  const tal620node = talentResolver.resolve(620, ctx);
  const tal620eff = tal620node.val;
  if (tal620eff > 0) {
    let maxCharLv = 0;
    const lv0All = saveData.lv0AllData || [];
    for (let ci = 0; ci < lv0All.length; ci++) {
      const clv = Number((lv0All[ci] && lv0All[ci][0]) || 0);
      if (clv > maxCharLv) maxCharLv = clv;
    }
    tal620raw = Math.min(tal620eff, Math.floor(maxCharLv / 10));
    addComputed(tal620raw);
  }

  const cardResult = computeCardBonusByType(cfg.cardType, charIdx, saveData);
  addComputed(cardResult.val);

  const flatTal2Val = cfg.flatTalent2 ? talentResolver.resolve(cfg.flatTalent2, ctx).val : 0;
  if (cfg.flatTalent2) addComputed(flatTal2Val);

  const stampBaseAllStat = computeStampBonusOfTypeX("BaseAllStat", saveData);
  addComputed(stampBaseAllStat.val);

  const boxRew20a = computeBoxReward(charIdx, "20a");
  addComputed(boxRew20a.val);
  const guildData = saveData.guildData;
  const gbPoints1 = guildData ? Number((guildData[0] || {})[1]) || 0 : 0;
  const _gb1: any = guildBonusParams(1);
  const guildBon1 =
    gbPoints1 > 0 && _gb1 ? formulaEval(_gb1.formula, _gb1.x1, _gb1.x2, gbPoints1) : 0;
  addComputed(guildBon1);
  const mealBonusStat = 0;
  const allStat = Math.floor(boxRew20a.val + mealBonusStat + guildBon1);

  const sigilVal = sigilResolver.resolve(cfg.sigilIdx, ctx).val;
  addComputed(sigilVal);

  let a4Val = 0;
  let a4bubble: { val: number; children: CorganNode[]; name?: string } | undefined;
  if (cfg.a4Bubble) {
    a4bubble = computeAlchBubble(cfg.a4Bubble, charIdx, saveData);
    a4Val = a4bubble.val;
    addComputed(a4Val);
  }

  const shinyVal = shinyResolver.resolve(cfg.shinyIdx, ctx).val;
  addComputed(shinyVal);
  const arcadeVal = arcadeResolver.resolve(cfg.arcadeIdx, ctx).val;
  addComputed(arcadeVal);
  const owlVal = owlResolver.resolve(5, ctx).val;
  addComputed(owlVal);

  let flatAddSum =
    extraTalentSum +
    buffVal +
    shimmerVal +
    boxStat.val +
    famBonus +
    starSignFlat +
    questsTal618 +
    tal620raw +
    cardResult.val +
    flatTal2Val +
    stampBaseAllStat.val +
    allStat +
    sigilVal +
    a4Val +
    shinyVal +
    arcadeVal +
    owlVal;
  if (statName === "LUK") flatAddSum -= shimmerVal;

  const flatAddChildren: CorganNode[] = [];
  if (extraTalentCh.length)
    flatAddChildren.push(node("Extra Talents", extraTalentSum, extraTalentCh, { fmt: "raw" }));
  if (buffVal > 0) flatAddChildren.push(node("Buff Bonus", buffVal, null, { fmt: "raw" }));
  if (statName !== "LUK") {
    flatAddChildren.push(
      node(
        "OLA[" + cfg.olaShimmer + "]*Shimmer",
        shimmerVal,
        [
          node("OLA Count", olaVal, null, { fmt: "raw" }),
          node("DreamShimmer", dreamShimmer, null, { fmt: "x" }),
        ],
        { fmt: "raw" }
      )
    );
  }
  flatAddChildren.push(
    node("BoxRewards[" + cfg.boxRewardsStat + "]", boxStat.val, boxStat.children, { fmt: "raw" }),
    node("FamBonusQTYs[" + cfg.famBonusIdx + "]", famBonus, null, { fmt: "raw" }),
    node(
      "StarSigns." + statName,
      starSignFlat,
      signBonuses.flat.children.length
        ? [
            node("Base Sum", signBonuses.flat.baseVal, signBonuses.flat.children, { fmt: "raw" }),
            node("Seraph Multi", signBonuses.flat.seraphMulti, null, { fmt: "x" }),
          ]
        : null,
      { fmt: "raw" }
    ),
    node(
      "min(Quests,tal618)",
      questsTal618,
      cfg.questsTal618
        ? [
            node("TotalQuestsComplete", saveData.totalQuestsComplete || 0, null, { fmt: "raw" }),
            node(label("Talent", 618, " Eff"), tal618eff, null, { fmt: "raw" }),
          ]
        : null,
      { fmt: "raw" }
    ),
    node("TalentCalc(620)", tal620raw, null, {
      fmt: "raw",
      note: "min(eff" + tal620eff + ", maxLv/10)",
    }),
    node("CardBonusREAL(" + cfg.cardType + ")", cardResult.val, cardResult.children, { fmt: "raw" })
  );
  if (cfg.flatTalent2)
    flatAddChildren.push(node("Talent " + cfg.flatTalent2, flatTal2Val, null, { fmt: "raw" }));
  flatAddChildren.push(
    node("Stamp BaseAllStat", stampBaseAllStat.val, stampBaseAllStat.children, { fmt: "raw" }),
    node(
      "AllStat",
      allStat,
      [
        node("BoxRewards[20a]", boxRew20a.val, boxRew20a.children, { fmt: "raw" }),
        node("GuildBonuses(1)", guildBon1, null, { fmt: "raw", note: "pts=" + gbPoints1 }),
        node("MealBonus(Stat)", 0, null, { fmt: "raw", note: "no meal gives Stat type" }),
      ],
      { fmt: "raw" }
    ),
    node("Sigil(" + cfg.sigilIdx + ")", sigilVal, null, { fmt: "raw" })
  );
  if (cfg.a4Bubble)
    flatAddChildren.push(
      node("AlchBubble " + cfg.a4Bubble, a4Val, a4bubble ? a4bubble.children : null, {
        fmt: "raw",
        note: a4bubble ? a4bubble.name : "",
      })
    );
  flatAddChildren.push(
    node("Shiny(" + cfg.shinyIdx + ")", shinyVal, null, { fmt: "raw" }),
    node("Arcade(" + cfg.arcadeIdx + ")", arcadeVal, null, { fmt: "raw" }),
    node("Owl(5)", owlVal, null, { fmt: "raw" })
  );

  // ==================== TOP LEVEL ====================
  const totalBubble = computeAlchBubble(cfg.totalBubble, charIdx, saveData);
  addComputed(totalBubble.val);
  const tal652 = talentResolver.resolve(652, ctx).val;
  addComputed(tal652);
  const comp8 = companionResolver.resolve(8, ctx).val;
  addComputed(comp8);

  const topLevel = totalBubble.val + tal652 + comp8;

  const topChildren = [
    node("AlchBubble " + cfg.totalBubble, totalBubble.val, totalBubble.children, {
      fmt: "raw",
      note: totalBubble.name,
    }),
    node(label("Talent", 652, " (Stat Overload)"), tal652, null, { fmt: "raw" }),
    node("Companions(8)", comp8, null, { fmt: "raw" }),
  ];

  // ==================== COMBINE ====================
  const inner = pctMult * (totalStatsDN + flatBaseSum + flatAddSum);
  const computed = Math.floor(topLevel + inner);

  const treeChildren = [
    node("Top Level", topLevel, topChildren, { fmt: "raw" }),
    node("Pct Multiplier (1 + pct/100)", pctMult, pctChildren, { fmt: "x" }),
    node("TotalStatsDN", totalStatsDN, equipDNchildren, { fmt: "raw" }),
    node("Flat Base", flatBaseSum, flatBaseChildren, { fmt: "raw" }),
    node("Flat Add", flatAddSum, flatAddChildren, { fmt: "raw" }),
    node("Computed Total", computed, null, { fmt: "raw" }),
  ];

  return {
    computed,
    missingCount: tracked.missing,
    missingNames: tracked.missingNames,
    tree: node("Total " + statName, computed, treeChildren, { fmt: "raw" }),
  };
}

// ==================== STATUE BONUS ====================
function _rval(
  resolver: { resolve: (id: any, ctx: any, args?: any) => CorganNode },
  id: number,
  ctx: any,
  args?: any
): number {
  try {
    return resolver.resolve(id, ctx, args).val || 0;
  } catch {
    return 0;
  }
}

function _safe(fn: (...a: any[]) => number, ...args: any[]): number {
  try {
    const v = fn(...args);
    return v !== v || v == null ? 0 : v;
  } catch {
    return 0;
  }
}

// Map class ID to primary damage stat name
export function primaryStatForClass(charIdx: number): string {
  const cls = Number((charClassData as any) && (charClassData as any)[charIdx]) || 0;
  if (cls <= 0) return "STR"; // Beginner default
  if (cls < 6) return "LUK"; // Journeyman family
  const root = 6 + 12 * Math.floor((cls - 6) / 12);
  if (root === 18) return "AGI";
  if (root === 30) return "WIS";
  return "STR";
}

export function computeStatueBonusGiven(
  idx: number,
  charIdx: number,
  saveData: SaveData
): TreeResult {
  const s = saveData;
  const statueLv = Number(s.statueData && s.statueData[idx]) || 0;
  if (statueLv <= 0) return treeResult(0, null);
  const baseBonus = Number((StatueInfo as any)[idx] && (StatueInfo as any)[idx][3]) || 1;
  let val = statueLv * baseBonus;
  const children: CorganNode[] = [
    node("Level", statueLv, null, { fmt: "raw" }),
    node("Base/Lv", baseBonus, null, { fmt: "raw" }),
  ];
  const _ci = charIdx != null ? charIdx : 0;
  const _ctx = { saveData: s, charIdx: _ci };
  if (idx === 0 || idx === 2 || idx === 8 || idx === 7) {
    if (idx !== 7) {
      const _t = _rval(talentResolver, 112, _ctx);
      if (_t > 0)
        children.push(node("Talent 112", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
      val *= Math.max(1, 1 + _t / 100);
    }
    if (idx !== 8) {
      const _t = _rval(talentResolver, 127, _ctx);
      if (_t > 0)
        children.push(node("Talent 127", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
      val *= Math.max(1, 1 + _t / 100);
    }
  } else if (idx === 1 || idx === 11 || idx === 9 || idx === 14) {
    if (idx !== 14) {
      const _t = _rval(talentResolver, 292, _ctx);
      if (_t > 0)
        children.push(node("Talent 292", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
      val *= Math.max(1, 1 + _t / 100);
    }
    if (idx !== 9) {
      const _t = _rval(talentResolver, 307, _ctx);
      if (_t > 0)
        children.push(node("Talent 307", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
      val *= Math.max(1, 1 + _t / 100);
    }
  } else if (idx === 10 || idx === 6 || idx === 12 || idx === 13) {
    if (idx !== 13) {
      const _t = _rval(talentResolver, 487, _ctx);
      if (_t > 0)
        children.push(node("Talent 487", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
      val *= Math.max(1, 1 + _t / 100);
    }
    if (idx !== 12) {
      const _t = _rval(talentResolver, 472, _ctx);
      if (_t > 0)
        children.push(node("Talent 472", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
      val *= Math.max(1, 1 + _t / 100);
    }
  } else if (idx === 3 || idx === 5 || idx === 17) {
    const _t = _rval(talentResolver, 37, _ctx);
    if (_t > 0)
      children.push(node("Talent 37", _t, null, { fmt: "raw", note: "×" + (1 + _t / 100).toFixed(2) }));
    val *= Math.max(1, 1 + _t / 100);
  }
  const statueG = Number(s.statueGData && s.statueGData[idx]) || 0;
  if (statueG >= 2) {
    const art30tier = Number(s.sailingData && s.sailingData[3] && s.sailingData[3][30]) || 0;
    const art30val = art30tier > 0 ? artifactBase(30) * Math.max(1, art30tier) : 0;
    const gMult = 1 + (100 + art30val) / 100;
    children.push(node("Gold G2", gMult, null, { fmt: "x", note: "art30=" + art30val.toFixed(0) }));
    val *= Math.max(1, gMult);
  }
  if (statueG >= 3) {
    const zmLv = Number(s.spelunkData && s.spelunkData[45] && s.spelunkData[45][0]) || 0;
    const zmMulti = Number((ZenithMarket as any) && (ZenithMarket as any)[0] && (ZenithMarket as any)[0][4]) || 1;
    const g3Mult = 1 + (50 + Math.floor(zmMulti * zmLv)) / 100;
    children.push(node("Gold G3", g3Mult, null, { fmt: "x", note: "zmLv=" + zmLv }));
    val *= Math.max(1, g3Mult);
  }
  if (idx === 0 || idx === 1 || idx === 2 || idx === 6) {
    const _v25 = _safe(vaultUpgBonus as any, 25, saveData);
    if (_v25 > 0) children.push(node("Vault 25", _v25, null, { fmt: "raw" }));
    val *= Math.max(1, 1 + _v25 / 100);
  }
  if (idx !== 29) {
    const _s29 = computeStatueBonusGiven(29, charIdx, saveData);
    const _s29v = Number(_s29.val) || 0;
    if (_s29v > 0)
      children.push(node("Statue 29 multi", _s29v, null, { fmt: "raw", note: "×" + (1 + _s29v / 100).toFixed(2) }));
    val *= Math.max(1, 1 + _s29v / 100);
  }
  const _evShop = eventShopOwned(19, s.cachedEventShopStr);
  const _t56 = _rval(talentResolver, 56, { saveData: s, charIdx: charIdx != null ? charIdx : 0 }, { mode: "max" });
  const _m26 = _safe(computeMeritocBonusz as any, 26, saveData);
  if (_evShop)
    children.push(node("EventShop 19", _evShop, null, { fmt: "raw", note: "×" + (1 + 0.3 * _evShop).toFixed(2) }));
  val *= 1 + 0.3 * _evShop;
  if (_t56 > 0)
    children.push(node("Talent 56", _t56, null, { fmt: "raw", note: "×" + (1 + _t56 / 100).toFixed(2) }));
  val *= Math.max(1, 1 + _t56 / 100);
  if (_m26 > 0)
    children.push(node("Meritoc 26", _m26, null, { fmt: "raw", note: "×" + (1 + _m26 / 100).toFixed(2) }));
  val *= 1 + _m26 / 100;
  return treeResult(val, children);
}

// ==================== MEAL BONUS ====================
export function computeMealBonus(effectKey: string, saveData: SaveData): TreeResult {
  const s = saveData;
  const meals0 = s.mealsData && s.mealsData[0];
  if (!meals0) return treeResult(0, null);
  const cookMulti = cookingMealMulti(s).val;
  let total = 0;
  const children: CorganNode[] = [];
  for (let mi = 0; mi < (MealINFO as any[]).length; mi++) {
    if (!(MealINFO as any[])[mi] || (MealINFO as any[])[mi][5] !== effectKey) continue;
    const mealLv = Number(meals0[mi]) || 0;
    if (mealLv <= 0) continue;
    const bonusPerLv = Number((MealINFO as any[])[mi][2]) || 0;
    const ribIdx = 28 + mi;
    const ribMeal = ribbonBonusAt(
      ribIdx,
      s.ribbonData,
      String((s.olaData && s.olaData[379]) || ""),
      s.weeklyBossData
    );
    const contrib = cookMulti * ribMeal * mealLv * bonusPerLv;
    total += contrib;
    children.push(
      node(
        "Meal " + mi + " (" + String((MealINFO as any[])[mi][0] || "").replace(/_/g, " ") + ")",
        contrib,
        null,
        { fmt: "raw", note: "lv=" + mealLv + " rib=" + ribMeal.toFixed(2) }
      )
    );
  }
  return treeResult(total, children);
}

// ==================== FAMILIAR BONUSES ====================
export function computeFamBonusQTY(famIdx: number, saveData: SaveData): number {
  const s = saveData;
  if (!ClassFamilyBonuses || !(ClassFamilyBonuses as any[])[famIdx]) return 0;
  const info = (ClassFamilyBonuses as any[])[famIdx];
  const bonusPerChar = Number(info[1]) || 0;
  let total = 0;
  for (let ci2 = 0; ci2 < numCharacters; ci2++) {
    const cls2 = Number((charClassData as any) && (charClassData as any)[ci2]) || 0;
    if (cls2 <= 0) continue;
    const lvArr = s.lv0AllData && s.lv0AllData[ci2];
    const classLv = Number(lvArr && lvArr[0]) || 0;
    if (classLv > 0) total += bonusPerChar;
  }
  return total;
}

// ==================== WORKBENCH (WORLD BOSS) ====================
export function computeWorkbenchStuff(saveData: SaveData): number {
  const s = saveData;
  const wboss = s.worldBossData;
  if (!wboss) return 1;
  let total = 1;
  for (let bi = 0; bi < 4; bi++) {
    const bossLv = Number(wboss[bi]) || 0;
    if (bossLv > 0) total *= 1 + bossLv / 100;
  }
  return total;
}
