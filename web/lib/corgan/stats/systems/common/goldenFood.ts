// ===== GOLDEN FOOD SYSTEM =====
// Pragmatic port of corgan-source/js/stats/systems/common/goldenFood.js.
//
// gfoodBonusMULTI() folds ~25 cross-system sources. We assemble them
// numerically (no tree) from the helpers each system already exposes.
// Coverage choices (deviations from corgan-source, all conservative):
//   - famBonusQTYs66 → max(1, ...) defaults to 1 (full FAMILY_BONUS_33
//     port belongs with a proper family-bonus module).
//   - etcBonuses8 → equipment + obol scan for %_GOLD_FOOD_EFFECT
//     (skips the chip/grid172/emm overrides; trophy/nametag/premhat
//     would land here via etcBonus(8) but the gfood resolve currently
//     calls this helper directly).
//   - calcTalentMAP209 → 0 (DK class 1B+ overkill maps; needs a kill-
//     tracker port that's outside DR scope).

import { node, type CorganNode } from "../../../node";
import {
  equipOrderData,
  equipQtyData,
  stampLvData,
  cauldronInfoData,
  skillLvData,
  charClassData,
  numCharacters,
  optionsListData,
} from "../../../save/data";
import { ribbonBonusAt } from "../../../game-helpers";
import { formulaEval, getLOG } from "../../../formulas";
import { GOLD_FOOD_INFO, EMPORIUM_FOOD_SLOTS } from "../../data/common/goldenFood";
import { sigilBonus } from "../w2/alchemy";
import { legendPTSbonus } from "../w7/spelunking";
import { computeMeritocBonusz } from "../w7/meritoc";
import { computeSeraphMulti } from "./starSign";
import { vaultUpgBonus } from "./vault";
import { votingBonusz } from "../w2/voting";
import { pristineBon } from "../w5/pristine";
import { getBribeBonus } from "../w3/bribe";
import { getSetBonus } from "../w3/setBonus";
import { computeCardLv } from "./cards";
import { companions } from "./companions";
import { computeAllTalentLVz } from "./talent";
import { talentParams, FAMILY_BONUS_33, CLASS_TREES, TALENT_144 } from "../../data/common/talent";
import { cookingMealMulti } from "./cooking";
import { isFightingMap, mapKillReq } from "../../data/common/maps";
import { klaData } from "../../../save/data";
import { bubbleParams } from "../../data/w2/alchemy";
import { isBubblePrismad, getPrismaBonusMult } from "../w2/alchemy";
import { starSignDropVal } from "../../data/common/starSign";
import { ACHIEVE_STATUS } from "../../data/game/hardcoded.js";
import { etcBonus } from "./etcBonus";
import { isExalted, computeStampDoublerSources } from "../w1/stamp";
import type { SaveData } from "../../../state";

type Ctx = {
  saveData: SaveData;
  charIdx: number;
  resolve?: (descId: string) => { val: number; children?: CorganNode[] } | null;
};

// ACHIEVE_STATUS keys are tier values ("5","10","20"); resolve to per-id.
const _ACH_LOOKUP: Record<number, number> = (() => {
  const out: Record<number, number> = {};
  for (const tierStr in ACHIEVE_STATUS) {
    const ids: number[] = (ACHIEVE_STATUS as any)[tierStr];
    for (const id of ids) out[id] = Number(tierStr);
  }
  return out;
})();

function achieveStatusTiered(idx: number, saveData: SaveData): number {
  if (
    !saveData ||
    !saveData.achieveRegData ||
    (saveData.achieveRegData as any)[idx] !== -1
  )
    return 0;
  return _ACH_LOOKUP[idx] || 1;
}

function etcBonusesGoldFood(charIdx: number, saveData: SaveData): number {
  return Number(etcBonus.resolve(8, { saveData, charIdx })?.val) || 0;
}

function alchBubblesGFoodz(charIdx: number, saveData: SaveData): number {
  const shim = bubbleParams(0, 18);
  if (!shim) return 0;
  const bubbleLv =
    Number(((cauldronInfoData as any)[0] || [])[shim.index]) || 0;
  if (bubbleLv <= 0) return 0;
  const baseVal = formulaEval(shim.formula, shim.x1, shim.x2, bubbleLv);
  // Opassz multi: Warrior classes (7-17) get bubble(0,1) "WR" multiplier.
  // Matches corgan-source goldenFood.js lines 338-347.
  const classId = (charClassData as any)[charIdx] || 0;
  const isWarrior = classId > 6 && classId < 18;
  let opassz = 1;
  if (isWarrior) {
    const wr = bubbleParams(0, 1);
    if (wr) {
      const wrLv =
        Number(((cauldronInfoData as any)[0] || [])[wr.index]) || 0;
      if (wrLv > 0) {
        const wrRaw = formulaEval(wr.formula, wr.x1, wr.x2, wrLv);
        const isWrPrisma = isBubblePrismad(wr.cauldron, wr.index);
        const wrPrisma = isWrPrisma
          ? Math.max(1, getPrismaBonusMult(saveData))
          : 1;
        opassz = wrRaw * wrPrisma;
      }
    }
  }
  const isPrisma = isBubblePrismad(shim.cauldron, shim.index);
  const prismaMult = isPrisma ? Math.max(1, getPrismaBonusMult(saveData)) : 1;
  return baseVal * Math.max(1, opassz) * prismaMult;
}

function stampBonusGFood(saveData: SaveData): number {
  const stampLv = Number(((stampLvData as any)[2] || [])[6]) || 0;
  if (stampLv <= 0) return 0;
  // Matches corgan-source: stampLv × (1 + StampDoubler/100) if exalted.
  const exalted = isExalted(2, 6, saveData);
  if (!exalted) return stampLv;
  const doubler = computeStampDoublerSources(saveData);
  const exaltedMulti = 1 + (doubler?.total || 0) / 100;
  return stampLv * exaltedMulti;
}

function getTalent99(charIdx: number, saveData: SaveData): number {
  const sl = (skillLvData as any)[charIdx] || {};
  const rawLv = Number(sl[99]) || 0;
  if (rawLv <= 0) return 0;
  const allTalentLv = computeAllTalentLVz(99, charIdx, undefined, saveData);
  const effectiveLv = rawLv + allTalentLv;
  const t99 = talentParams(99);
  if (!t99) return 0;
  return formulaEval(t99.formula, t99.x1, t99.x2, effectiveLv);
}

function famBonusQTYs66(charIdx: number, saveData: SaveData): number {
  if (!FAMILY_BONUS_33) return 0;
  // theFamilyGuy (talent 144) multiplies family bonus when the active char
  // is the best contributor for this family bonus.
  let talent144Val = 0;
  if (TALENT_144) {
    const sl144 = (skillLvData as any)[charIdx] || {};
    const rawLv144 = Number(sl144[144] || sl144["144"]) || 0;
    if (rawLv144 > 0) {
      const bonus144Lv = computeAllTalentLVz(144, charIdx, undefined, saveData);
      const eff144 = rawLv144 + bonus144Lv;
      talent144Val = formulaEval(
        TALENT_144.formula,
        TALENT_144.x1,
        TALENT_144.x2,
        eff144
      );
    }
  }
  let maxBonus = 0;
  for (let ci = 0; ci < numCharacters; ci++) {
    const classId = (charClassData as any)[ci] || 0;
    const tree = CLASS_TREES[classId];
    if (!tree || !tree.includes(33)) continue;
    const charLevel =
      Number(((saveData.lv0AllData as any)?.[ci] || [])[0]) || 0;
    const effectiveLv = Math.max(0, charLevel - FAMILY_BONUS_33.lvOffset);
    let bonus = formulaEval(
      FAMILY_BONUS_33.formula,
      FAMILY_BONUS_33.x1,
      FAMILY_BONUS_33.x2,
      effectiveLv
    );
    // theFamilyGuy only applies when the active char IS this contributor.
    if (ci === charIdx && talent144Val > 0) {
      bonus = bonus * (1 + talent144Val / 100);
    }
    if (bonus > maxBonus) maxBonus = bonus;
  }
  return maxBonus;
}

// apocalypseWow × apocalypses: DK class talent (skillIndex 209) × number
// of fighting maps where DK has accumulated ≥ 1e9 kills.
function apocalypseWowContrib(saveData: SaveData): number {
  // Find a DK character. corgan-source uses tree[3] === 10 as the marker.
  let dkIdx = -1;
  for (let ci = 0; ci < numCharacters; ci++) {
    const classId = (charClassData as any)[ci] || 0;
    const tree = CLASS_TREES[classId];
    if (tree && tree[3] === 10) dkIdx = ci;
  }
  if (dkIdx < 0) return 0;

  // Talent 209 (APOCALYPSE_WOW) value for the DK character.
  const sl = (skillLvData as any)[dkIdx] || {};
  const rawLv = Number(sl[209]) || 0;
  if (rawLv <= 0) return 0;
  const bonusLv = computeAllTalentLVz(209, dkIdx, undefined, saveData);
  const eff = rawLv + bonusLv;
  const t209 = talentParams(209);
  if (!t209) return 0;
  const perPt = formulaEval(t209.formula, t209.x1, t209.x2, eff);

  // Apocalypse count = number of fighting maps with ≥ 1e9 kills on DK.
  let count = 0;
  const kla = (klaData as any)[dkIdx] || [];
  for (let m = 0; m < kla.length; m++) {
    if (!isFightingMap(m)) continue;
    const arr = kla[m];
    if (!Array.isArray(arr)) continue;
    const killsDone = mapKillReq(m) - Number(arr[0]);
    if (killsDone >= 1e9) count++;
  }
  return perPt * count;
}

function mealBonusZGoldFood(saveData: SaveData): number {
  const mealLv = Number(((saveData.mealsData as any) || [])[0]?.[64]) || 0;
  if (mealLv <= 0) return 0;
  const cm = cookingMealMulti(saveData);
  const ribbonIdx = 28 + 64;
  const ribbon = ribbonBonusAt(
    ribbonIdx,
    saveData.ribbonData,
    (optionsListData as any)[379],
    saveData.weeklyBossData
  );
  return cm.val * ribbon * mealLv * 2;
}

export function gfoodBonusMULTI(
  charIdx: number,
  _opts: unknown,
  saveData: SaveData
): number {
  return gfoodBonusMULTIBreakdown(charIdx, saveData).total;
}

// Single source of truth for gfoodBonusMULTI: computes each sub-component by
// name and folds them into the total. gfoodBonusMULTI() returns just .total;
// dump-gfood-multi.ts uses .items to find divergences vs Corgan's tree.
// N.js literal (line 4954740): e = (1 + SECRET_SET/100) × (max(famBonus,1) + rest) / 100
// The whole (famBonus + rest) is summed first, THEN divided by 100.
export function gfoodBonusMULTIBreakdown(
  charIdx: number,
  saveData: SaveData
): { items: { name: string; val: number; corgan?: number }[]; total: number } {
  const setBonus = getSetBonus("SECRET_SET");
  const setMul = 1 + (Number(setBonus?.val) || 0) / 100;
  const famBonus = Math.max(famBonusQTYs66(charIdx, saveData), 1);
  const etcG = etcBonusesGoldFood(charIdx, saveData);
  const talent99 = getTalent99(charIdx, saveData);
  const stampG = stampBonusGFood(saveData);
  const ach37 = achieveStatusTiered(37, saveData);
  const alchG = alchBubblesGFoodz(charIdx, saveData);
  const sigil14 = sigilBonus(14, saveData);
  const mealG = mealBonusZGoldFood(saveData);
  const starS69 = starSignDropVal(69) * computeSeraphMulti(charIdx, saveData);
  const bribe36 = Number(getBribeBonus(36, saveData)?.val) || 0;
  const pristine14 = pristineBon(14, saveData);
  const ach380 = achieveStatusTiered(380, saveData);
  const ach383 = achieveStatusTiered(383, saveData);
  const voting26 = votingBonusz(26, undefined, saveData);
  const talent209xMaps = apocalypseWowContrib(saveData);
  const comp48 = companions(48, saveData);
  const legend25 = legendPTSbonus(25, saveData);
  const cardPassiveBonus = Math.min(
    4 * computeCardLv("cropfallEvent1", saveData) +
      5 * computeCardLv("anni5Event1", saveData),
    50
  );
  const comp155 = companions(155, saveData);
  const vault86 = vaultUpgBonus(86, saveData);

  const items = [
    { name: "setMul (SECRET_SET)", val: setMul, corgan: 1 },
    { name: "famBonus (Family 66)", val: famBonus, corgan: 1.3774 },
    { name: "etcBonuses(8) Gold Food", val: etcG },
    { name: "Talent 99 (Hungry For Gold)", val: talent99, corgan: 48.8633 },
    { name: "Stamp Golden Food", val: stampG, corgan: 729.9845 },
    { name: "Achievement 37 (Nutty Crafter)", val: ach37, corgan: 5 },
    { name: "Bubble Shimmeron", val: alchG, corgan: 2487.5502 },
    { name: "Sigil 14 (Emoji Veggie)", val: sigil14, corgan: 420 },
    { name: "Meal Yumi Peachring", val: mealG, corgan: 31300 },
    { name: "Star Sign 69 + Seraph", val: starS69 },
    { name: "Bribe 36", val: bribe36 },
    { name: "Pristine 14", val: pristine14 },
    { name: "2× Achievement 380", val: 2 * ach380 },
    { name: "3× Achievement 383", val: 3 * ach383 },
    { name: "Voting Bonus 26", val: voting26 },
    { name: "Talent 209 × Maps", val: talent209xMaps },
    { name: "Companion 48", val: comp48 },
    { name: "Legend 25", val: legend25 },
    { name: "Card cropfall+anni5", val: cardPassiveBonus },
    { name: "Companion 155", val: comp155 },
    { name: "Vault 86", val: vault86 },
  ];
  const rest = items.slice(2).reduce((a, i) => a + i.val, 0);
  return { items, total: (setMul * (famBonus + rest)) / 100 };
}

type GoldFoodResult = {
  total: number;
  equipped: {
    item: string;
    amount: number;
    qty: number;
    lg: number;
    val: number;
  } | null;
  emporium: {
    item: string;
    amount: number;
    empLevel: number;
    effQty: number;
    lg: number;
    val: number;
  } | null;
};

export function goldFoodBonuses(
  effectType: string,
  charIdx: number,
  preMulti: number | undefined,
  saveData: SaveData
): GoldFoodResult {
  const multi = preMulti != null ? preMulti : gfoodBonusMULTI(charIdx, null, saveData);
  let total = 0;
  let equippedInfo: GoldFoodResult["equipped"] = null;
  let emporiumInfo: GoldFoodResult["emporium"] = null;

  const foodBag =
    ((equipOrderData as any)[charIdx] && (equipOrderData as any)[charIdx][2]) || {};
  const qtyBag =
    ((equipQtyData as any)[charIdx] && (equipQtyData as any)[charIdx][2]) || {};

  for (let i = 0; i < 16; i++) {
    const itemName = (foodBag as any)[i] || "Blank";
    if (itemName === "Blank") continue;
    const info = GOLD_FOOD_INFO[itemName];
    if (!info || info.effect !== effectType) continue;
    const qty = Number((qtyBag as any)[i]) || 0;
    const lg = getLOG(1 + qty);
    const val = info.amount * multi * 0.05 * lg * (1 + lg / 2.14);
    total = val;
    equippedInfo = { item: itemName, amount: info.amount, qty, lg, val };
  }

  // Emporium (account-wide global food)
  const ninja104 = saveData.ninjaData && saveData.ninjaData[104];
  const empUnlocked = Array.isArray(ninja104)
    ? (ninja104 as any[]).some((v) => Number(v) > 0)
    : true;
  if (empUnlocked) {
    for (let i = 0; i < EMPORIUM_FOOD_SLOTS.length; i++) {
      const itemName = EMPORIUM_FOOD_SLOTS[i];
      const info = GOLD_FOOD_INFO[itemName];
      if (!info || info.effect !== effectType) continue;
      const empLevel =
        Number(((saveData.ninjaData && (saveData.ninjaData[104] as any)) || [])[i]) || 0;
      if (empLevel > 0) {
        const effQty = 1000 * Math.pow(10, empLevel);
        const lg = getLOG(1 + effQty);
        const val = info.amount * multi * 0.05 * lg * (1 + lg / 2.14);
        total += val;
        emporiumInfo = { item: itemName, amount: info.amount, empLevel, effQty, lg, val };
      }
    }
  }

  return { total, equipped: equippedInfo, emporium: emporiumInfo };
}

export const goldenFood = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const gfm = ctx.resolve ? ctx.resolve("gfood-multi") : null;
    // Always compute the real gfoodBonusMULTI so display reflects the actual
    // multiplier (previously the display was the stage-2 stub value of 1).
    const realMulti = gfoodBonusMULTI(ctx.charIdx, null, ctx.saveData);
    const multi = gfm ? gfm.val : realMulti;
    const result = goldFoodBonuses(id, ctx.charIdx, multi, ctx.saveData);
    const total = result ? result.total : 0;
    if (total <= 0) return node("Golden Food: " + id, 0);

    const children: CorganNode[] = [];

    if (gfm) {
      children.push(node("GFood Multi", gfm.val, gfm.children, { fmt: "x" }));
    } else {
      children.push(
        node("GFood Multi", realMulti, null, {
          fmt: "x",
          note: "gfoodBonusMULTI direct",
        })
      );
    }

    if (result.equipped) {
      const e = result.equipped;
      children.push(
        node(
          "Equipped: " + e.item,
          e.val,
          [
            node("Base Amount", e.amount, null, { fmt: "raw" }),
            node("Quantity", e.qty, null, { fmt: "raw" }),
            node("Log Factor", e.lg, null, { fmt: "raw" }),
          ],
          { fmt: "raw" }
        )
      );
    }
    if (result.emporium) {
      const em = result.emporium;
      children.push(
        node(
          "Emporium: " + em.item,
          em.val,
          [
            node("Base Amount", em.amount, null, { fmt: "raw" }),
            node("Emporium Lv", em.empLevel, null, { fmt: "raw" }),
            node("Eff Qty", em.effQty, null, { fmt: "raw" }),
          ],
          { fmt: "raw" }
        )
      );
    }

    return node("Golden Food: " + id, total, children, { fmt: "+" });
  },
};
