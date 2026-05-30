// ===== ALCHEMY SYSTEM (W2) =====
// 1:1 port of corgan-source/js/stats/systems/w2/alchemy.js. Provides
// bubble lookup, prisma multiplier, sigil resolver, and effect-key
// bubble/vial lookups.

import { node, treeResult, type CorganNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import {
  cauldronInfoData,
  optionsListData,
  charClassData,
} from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { vaultUpgBonus } from "../common/vault";
import { arcaneUpgBonus } from "../mc/tesseract";
import { computeMeritocBonusz } from "../w7/meritoc";
import { arcadeBonus } from "./arcade";
import { legendPTSbonus } from "../w7/spelunking";
import { paletteParams } from "../../data/w4/gaming";
import { exoticParams } from "../../data/w5/farming";
import { sigilTiers, sigilCodename } from "../../data/common/sigils";
import { rogBonusQTY } from "../w7/sushi";
import { bubbleParams } from "../../data/w2/alchemy";
import { AlchemyDescription } from "../../data/game/customlists.js";
import { mainframeBonus } from "../w4/lab";
import { N2L } from "../../data/common/encoding";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export function sigilBonus(sigilIdx: number, saveData: SaveData): number {
  const level =
    Number(
      ((saveData.cauldronP2WData as any)?.[4] || [])[1 + 2 * sigilIdx]
    ) || 0;
  if (level < -0.1) return 0;
  const tiers = sigilTiers(sigilIdx);
  if (!tiers) return 0;
  // N.js linha 7744288 — tier select by sigil level:
  //   <0.5 → tier 0, <1.5 → tier 1, <2.5 → tier 2, <3.5 → tier 3, else tier 4 (Eclectic).
  let base: number;
  if (level < 0.5) base = tiers[0];
  else if (level < 1.5) base = tiers[1];
  else if (level < 2.5) base = tiers[2];
  else if (level < 3.5) base = tiers[3];
  else base = tiers[4];
  const tier16 = Number((saveData.sailingData as any)?.[3]?.[16]) || 0;
  const artifactMulti = 1 + (tier16 === 0 ? 0 : Math.max(1, tier16));
  const meritocMulti = 1 + computeMeritocBonusz(21, saveData) / 100;
  return base * artifactMulti * meritocMulti;
}

const BUBBLE_KEYS: Record<string, { cauldron: number; index: number }> = {
  DROPPIN_LOADS: { cauldron: 3, index: 1 },
};

export function isBubblePrismad(cauldron: number, bubbleIdx: number): boolean {
  const prismaStr = String((optionsListData as any)?.[384] ?? "");
  const letter = N2L[cauldron] || "";
  return prismaStr.indexOf(letter + Math.round(bubbleIdx) + ",") !== -1;
}

export function getPrismaBonusMult(saveData: SaveData): number {
  const arcane45 = arcaneUpgBonus(45, saveData);
  const arcade54 = arcadeBonus(54, saveData).val;
  const cards1 = saveData.cards1Data || [];
  const hasW6Trophy = (
    Array.isArray(cards1)
      ? (cards1 as any[]).indexOf("Trophy23") >= 0
      : JSON.stringify(cards1).indexOf("Trophy23") >= 0
  )
    ? 10
    : 0;
  const palLv = Number(
    (saveData.spelunkData &&
      (saveData.spelunkData[9] as any)?.[28]) ||
      0
  );
  const pal28 = paletteParams(28) as any;
  const palRaw = palLv > 0 ? (palLv / (palLv + pal28.denom)) * pal28.coeff : 0;
  const palLegendMulti = 1 + legendPTSbonus(10, saveData) / 100;
  const loreFlag8 =
    Number(
      (saveData.spelunkData && (saveData.spelunkData[0] as any)?.[8]) || 0
    ) >= 1
      ? 1
      : 0;
  const palLoreMulti = 1 + 0.5 * loreFlag8;
  const palette28 = palRaw * palLegendMulti * palLoreMulti;
  let purpleSigils = 0;
  const sigArr =
    saveData.cauldronP2WData && (saveData.cauldronP2WData[4] as any[]);
  if (sigArr) {
    for (let si = 0; si < 24; si++) {
      if (Number((sigArr as any)[1 + 2 * si]) >= 3) purpleSigils++;
    }
  }
  const ex48 = exoticParams(48);
  const exLv = Number((saveData.farmUpgData as any)?.[ex48.farmSlot]) || 0;
  const exotic48 = exLv > 0 ? (ex48.base * exLv) / (ex48.denom + exLv) : 0;
  const legend36 = legendPTSbonus(36, saveData);
  const comp88 =
    saveData.companionIds && saveData.companionIds.has(88) ? 1 : 0;
  const sushiRoG23 = rogBonusQTY(23, saveData.cachedUniqueSushi || 0);
  const sum =
    arcane45 +
    arcade54 +
    sushiRoG23 +
    hasW6Trophy +
    palette28 +
    0.2 * purpleSigils +
    exotic48 +
    legend36 +
    50 * comp88;
  return Math.min(4, 2 + sum / 100);
}

export function bubbleBonusY13(saveData: SaveData): number {
  const data = bubbleParams(3, 32);
  if (!data) return 0;
  const lv =
    Number((cauldronInfoData as any)?.[data.cauldron]?.[data.index]) || 0;
  if (lv <= 0) return 0;
  const baseVal = formulaEval(data.formula, data.x1, data.x2, lv);
  const isPrisma = isBubblePrismad(data.cauldron, data.index);
  const prismaMult = isPrisma ? Math.max(1, getPrismaBonusMult(saveData)) : 1;
  return baseVal * prismaMult;
}

export const alchemy = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const bk = BUBBLE_KEYS[id];
    if (!bk) return node(label("Bubble", id), 0, null, { note: "bubble " + id });
    const bubbleId = [bk.cauldron, bk.index];
    const data = bubbleParams(bk.cauldron, bk.index);
    if (!data)
      return node(label("Bubble", bubbleId), 0, null, { note: "bubble " + id });
    const lv =
      Number((cauldronInfoData as any)?.[data.cauldron]?.[data.index]) || 0;
    if (lv <= 0)
      return node(label("Bubble", bubbleId), 0, null, { note: "bubble " + id });
    const baseVal = formulaEval(data.formula, data.x1, data.x2, lv);
    const isPrisma = isBubblePrismad(data.cauldron, data.index);
    const prismaMult = isPrisma ? Math.max(1, getPrismaBonusMult(saveData)) : 1;
    const val = baseVal * prismaMult;
    const children: CorganNode[] = [
      node("Bubble Level", lv, null, { fmt: "raw" }),
      node("Base Value", baseVal, null, { fmt: "raw" }),
    ];
    if (isPrisma) {
      children.push(
        node("Prisma Bonus", prismaMult, null, { fmt: "x", note: "cap 4" })
      );
    }
    return node(label("Bubble", bubbleId), val, children, {
      fmt: "+",
      note: "bubble " + id,
    });
  },
};

// Title-case SCREAMING_SNAKE codenames (TROVE → "Trove", PUMPED_KICKS →
// "Pumped Kicks") so sigil labels read as game-natural text.
function titleCaseFromSnake(raw: string): string {
  return (raw || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

export const sigil = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const codename = sigilCodename(id);
    const friendly = codename ? titleCaseFromSnake(codename) : "";
    const name = friendly
      ? `${friendly} Sigil (Sigil ${id})`
      : label("Sigil", id);
    const level =
      Number(((saveData.cauldronP2WData as any)?.[4] || [])[1 + 2 * id]) || 0;
    if (level < -0.1) return node(name, 0, null, { note: "sigil " + id });
    const tiers = sigilTiers(id);
    if (!tiers) return node(name, 0, null, { note: "sigil " + id });
    // N.js linha 7744288 — tier select by sigil level:
    //   <0.5 → tier 0, <1.5 → tier 1, <2.5 → tier 2, <3.5 → tier 3, else tier 4 (Eclectic).
    let base: number;
    if (level < 0.5) base = tiers[0];
    else if (level < 1.5) base = tiers[1];
    else if (level < 2.5) base = tiers[2];
    else if (level < 3.5) base = tiers[3];
    else base = tiers[4];
    const tier16 = Number((saveData.sailingData as any)?.[3]?.[16]) || 0;
    const artifactMulti = 1 + (tier16 ? Math.max(1, tier16) : 0);
    const meritocMulti = 1 + (computeMeritocBonusz(21, saveData) || 0) / 100;
    const val = base * artifactMulti * meritocMulti;
    return node(
      name,
      val,
      [
        node("Sigil Level", level, null, { fmt: "raw" }),
        node("Base Bonus", base, null, { fmt: "raw" }),
        node(label("Artifact", 16, " Bonus"), artifactMulti, null, {
          fmt: "x",
          note: "artifact 16",
        }),
        node(label("Meritoc", 21), meritocMulti, null, { fmt: "x" }),
      ],
      { fmt: "+", note: "sigil " + id }
    );
  },
};

export function bubbleValByKey(
  key: string,
  charIdx: number,
  saveData: SaveData
): TreeResult {
  const _alch = AlchemyDescription as any[];
  for (let c2 = 0; c2 < 4; c2++) {
    const arr = _alch[c2];
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i][15] === key) {
        const lv =
          Number((cauldronInfoData as any)?.[c2]?.[i]) || 0;
        if (lv <= 0) return treeResult(0, null);
        const baseVal = formulaEval(
          arr[i][3],
          Number(arr[i][1]),
          Number(arr[i][2]),
          lv
        );
        const children: CorganNode[] = [
          node("Level", lv, null, { fmt: "raw" }),
          node("Base", baseVal, null, { fmt: "raw" }),
        ];
        const isPrisma = isBubblePrismad(c2, i);
        const prismaMult = isPrisma
          ? Math.max(1, getPrismaBonusMult(saveData))
          : 1;
        let val = baseVal * prismaMult;
        if (isPrisma)
          children.push(node("Prisma", prismaMult, null, { fmt: "x" }));
        const cls = Number((charClassData as any)?.[charIdx]) || 0;
        if (
          cls > 6 &&
          i !== 16 &&
          i < 30 &&
          i > 0 &&
          key.indexOf("passz") < 0 &&
          key.indexOf("ACTIVE") < 0 &&
          key.indexOf("AllCharz") < 0
        ) {
          if (c2 === 0 && cls < 18 && key !== "Construction") {
            const _pm = Math.max(1, bubbleValByKey("Opassz", charIdx, saveData).val);
            val *= _pm;
            if (_pm > 1) children.push(node("Opassz", _pm, null, { fmt: "x" }));
          } else if (c2 === 1 && cls >= 18 && cls < 30) {
            const _pm = Math.max(1, bubbleValByKey("Gpassz", charIdx, saveData).val);
            val *= _pm;
            if (_pm > 1) children.push(node("Gpassz", _pm, null, { fmt: "x" }));
          } else if (c2 === 2 && cls >= 30 && cls < 42) {
            const _pm = Math.max(1, bubbleValByKey("Ppassz", charIdx, saveData).val);
            val *= _pm;
            if (_pm > 1) children.push(node("Ppassz", _pm, null, { fmt: "x" }));
          }
        }
        return treeResult(val, children);
      }
    }
  }
  return treeResult(0, null);
}

export function computeVialByKey(
  effectKey: string,
  saveData: SaveData
): TreeResult {
  const vials = (AlchemyDescription as any)[4];
  if (!vials) return treeResult(0);
  let total = 0;
  const children: CorganNode[] = [];
  for (let vi = 0; vi < vials.length; vi++) {
    if (!vials[vi] || vials[vi][11] !== effectKey) continue;
    const vialLv =
      Number((cauldronInfoData as any)?.[4]?.[vi]) || 0;
    if (vialLv <= 0) continue;
    const rawVal = formulaEval(
      vials[vi][3],
      Number(vials[vi][1]) || 0,
      Number(vials[vi][2]) || 0,
      vialLv
    );
    const labMult = mainframeBonus(10, saveData) === 2 ? 2 : 1;
    const riftActive = Number(saveData.riftData && saveData.riftData[0]) > 34;
    let maxLvVials = 0;
    if (riftActive) {
      const ci4 = (cauldronInfoData as any)?.[4];
      for (let rvi = 0; ci4 && rvi < ci4.length; rvi++) {
        if ((Number(ci4[rvi]) || 0) >= 13) maxLvVials++;
      }
    }
    const dNzz =
      (riftActive ? 2 * maxLvVials : 0) + (vaultUpgBonus(42, saveData) || 0);
    const meritoc20 = computeMeritocBonusz(20, saveData) || 0;
    const contrib =
      labMult * (1 + dNzz / 100) * (1 + meritoc20 / 100) * rawVal;
    total += contrib;
    children.push(
      node(vials[vi][0] || "Vial " + vi, contrib, null, {
        fmt: "raw",
        note:
          "lab×" +
          labMult +
          " riftVault×" +
          (1 + dNzz / 100).toFixed(2) +
          " meritoc×" +
          (1 + meritoc20 / 100).toFixed(2),
      })
    );
  }
  return treeResult(total, children);
}

// Resolver for drop-rate (and other) descriptors: a vial identified by its
// effect key (AlchemyDescription[4][*][11], e.g. "7drMulto" = W7 Ship-in-a-Bottle,
// the % Drop Rate MULTIPLIER vial). The game applies it as ×(1 + val/100), so we
// return fmt "+" — the post-mult pool turns that into the multiplier.
export const vial = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const r = computeVialByKey(id, ctx.saveData);
    return node("Drop Rate Vial", r.val, r.children, {
      fmt: "+",
      note: "vial " + id,
    });
  },
};
