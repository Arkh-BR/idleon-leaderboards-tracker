// ===== CARDS SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/cards.js.
// Cross-deps on Stage 3+4 (legendPTSbonus, charHasChip) are stubbed in
// systems/w7/spelunking and systems/w4/lab and return safe no-ops until
// those stages land — they only affect a single multiplier each, never the
// raw card level.

import { node, treeResult, type ArkhNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { cardEquipData, csetEqData } from "../../../save/data";
import { CARD_BASE_REQ, CARD_DR_BONUS, CARD_DR_MULTI } from "../../data/common/cards";
import { IDforCardSETbonus } from "../../data/game/custommaps.js";
import { MONSTERS } from "../../data/game/monsters.js";
import { legendPTSbonus } from "../w7/spelunking";
import { charHasChip } from "../w4/lab";
import { RANDOlist } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export function computeCardLv(cardKey: string, saveData: SaveData): number {
  if (!saveData || !saveData.cards0Data) return 0;
  const qty = Number((saveData.cards0Data as any)[cardKey]) || 0;
  if (qty <= 0) return 0;
  const rift5star = (saveData.riftData[0] || 0) >= 45 ? 1 : 0;
  const spelunk6star =
    ((saveData.spelunkData && saveData.spelunkData[0] && saveData.spelunkData[0][2]) || 0) >= 1
      ? 1
      : 0;
  const maxStars = Math.round(4 + rift5star + spelunk6star);
  let lv = 1;
  if (cardKey === "Boss3B") {
    for (let s = 0; s < maxStars; s++) {
      if (qty > 1.5 * Math.pow(s + 1 + Math.floor(s / 3), 2)) lv = s + 2;
    }
  } else {
    const baseReq = CARD_BASE_REQ[cardKey] || 10;
    for (let s = 0; s < maxStars; s++) {
      const thr =
        baseReq *
        Math.pow(
          s +
            1 +
            Math.floor(s / 3) +
            16 * Math.floor(s / 4) +
            100 * Math.floor(s / 5),
          2
        );
      if (qty > thr) lv = s + 2;
    }
  }
  const ola155 = String(saveData.olaData[155] || "");
  if (ola155.split(",").includes(cardKey) && lv < 6) lv = 6;
  return lv;
}

export function cardLv(cardId: string, saveData: SaveData): number {
  return computeCardLv(cardId, saveData);
}

export function computeCardLvDetail(cardKey: string, saveData: SaveData) {
  const qty = Number((saveData.cards0Data as any)[cardKey]) || 0;
  if (qty <= 0)
    return { lv: 0, qty: 0, maxStars: 0, rift5: false, spelunk6: false };
  const rift5star = (saveData.riftData[0] || 0) >= 45 ? 1 : 0;
  const spelunk6star =
    ((saveData.spelunkData && saveData.spelunkData[0] && saveData.spelunkData[0][2]) || 0) >= 1
      ? 1
      : 0;
  const maxStars = Math.round(4 + rift5star + spelunk6star);
  let lv = 1;
  if (cardKey === "Boss3B") {
    for (let s = 0; s < maxStars; s++) {
      if (qty > 1.5 * Math.pow(s + 1 + Math.floor(s / 3), 2)) lv = s + 2;
    }
  } else {
    const baseReq = CARD_BASE_REQ[cardKey] || 10;
    for (let s = 0; s < maxStars; s++) {
      const thr =
        baseReq *
        Math.pow(
          s +
            1 +
            Math.floor(s / 3) +
            16 * Math.floor(s / 4) +
            100 * Math.floor(s / 5),
          2
        );
      if (qty > thr) lv = s + 2;
    }
  }
  const ola155 = String(saveData.olaData[155] || "");
  if (ola155.split(",").includes(cardKey) && lv < 6) lv = 6;
  return { lv, qty, maxStars, rift5: !!rift5star, spelunk6: !!spelunk6star };
}

// Map bonus-type ID to its card bonus table.
const CARD_BONUS_TABLES: Record<number, Record<string, number>> = {
  10: CARD_DR_BONUS,
  101: CARD_DR_MULTI,
};

const CARD_SET_KEYS: Record<number, string> = {
  5: "{%_Dmg,_Drop,_and_EXP",
  6: "{%_Drop_Rate",
};

export const card = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const saveData = ctx.saveData;
    const table = CARD_BONUS_TABLES[id];
    if (!table) return node("Card: #" + id, 0);
    const name = label("Card Type", id);
    const equipped = (cardEquipData as any)[ctx.charIdx] || [];
    if (!equipped.length) return node(name, 0);

    const legend21 = legendPTSbonus(21, saveData);
    const legendMulti = 1 + legend21 / 100;
    let total = 0;
    const children: ArkhNode[] = [];

    for (let i = 0; i < equipped.length; i++) {
      const cardKey = equipped[i] as string;
      if (!cardKey || cardKey === "B") continue;
      const bonusVal = table[cardKey];
      if (bonusVal == null) continue;
      const lv = computeCardLv(cardKey, saveData);
      const qty = Number((saveData.cards0Data as any)[cardKey]) || 0;
      const rift5star = (saveData.riftData[0] || 0) >= 45 ? 1 : 0;
      const spelunk6star =
        ((saveData.spelunkData && saveData.spelunkData[0] && saveData.spelunkData[0][2]) || 0) >= 1
          ? 1
          : 0;
      const maxStars = Math.round(4 + rift5star + spelunk6star);
      const chipDouble =
        (i === 0 && charHasChip(ctx.charIdx, "card1")) ||
        (i === 7 && charHasChip(ctx.charIdx, "card2"))
          ? 2
          : 1;
      const contrib = chipDouble * lv * bonusVal * legendMulti;
      const slotChildren: ArkhNode[] = [
        node("Card Qty", qty, null, { fmt: "raw" }),
        node("Star Lv", lv, null, { fmt: "raw", note: "max " + maxStars + " stars" }),
        node("Bonus/Star", bonusVal, null, { fmt: "raw" }),
        node("Rift 5th Star", rift5star, null, { fmt: "raw" }),
        node("Spelunk 6th Star", spelunk6star, null, { fmt: "raw" }),
      ];
      if (chipDouble > 1) {
        slotChildren.push(
          node("Chip ×2", 2, null, {
            fmt: "x",
            note: i === 0 ? "card1" : "card2",
          })
        );
      }
      children.push(
        // Named by IDENTITY (no " LvN" suffix — the level is the "Star Lv"
        // child) so the node path is stable across players. A level in the
        // name would fragment the top-player reference per level: the same
        // card owned at Lv4 and Lv6 by different players would land on two
        // paths, double-counting in the card multi's frankenstein sum and
        // leaving lower-tier rows comparing against the wrong max.
        node(label("Card", cardKey), contrib, slotChildren, {
          fmt: "+",
        })
      );
      total += contrib;
    }
    // Catalog: every obtainable DR card of this type that ISN'T equipped shows
    // as a +0 reference row so the breakdown (and the Observed-Max overlay)
    // lists them all — matching the nametag/trophy resolvers. Unreleased
    // placeholder cards (source mob ExpGiven <= 1, e.g. W7-zone-B) are omitted.
    const ownedKeys = new Set(
      (equipped as string[]).filter((k) => k && k !== "B")
    );
    for (const key of Object.keys(table)) {
      if (ownedKeys.has(key)) continue;
      const mob = (MONSTERS as Record<string, { ExpGiven?: number }>)[key];
      if (mob && Number(mob.ExpGiven) <= 1) continue; // unreleased placeholder
      children.push(
        node(label("Card", key), 0, null, { fmt: "+", note: "not equipped" })
      );
    }
    if (legendMulti !== 1) {
      const legend21raw = legendPTSbonus(21, saveData);
      children.push(
        node(
          "Legendary Cardholder (Legend 21) ×",
          legendMulti,
          [node("Legend PTS", legend21raw, null, { fmt: "raw" })],
          { fmt: "x" }
        )
      );
    }
    return node(name, total, children, { fmt: "+" });
  },
};

export const cardSet = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const name = label("Card Set", id);
    const setKey = CARD_SET_KEYS[id];
    if (!setKey) return node(name, 0);
    const eq = (csetEqData as any)[ctx.charIdx];
    if (!eq) return node(name, 0);
    const val = Number(eq[setKey]) || 0;
    return node(name, val, null, { fmt: "+" });
  },
};

export const cardSingle = {
  resolve(id: string, ctx: Ctx, args?: number[]): ArkhNode {
    const saveData = ctx.saveData;
    const perStar = args ? args[0] : 1;
    const cap = args ? args[1] : 999;
    const lv = computeCardLv(id, saveData);
    const qty = Number((saveData.cards0Data as any)[id]) || 0;
    const val = Math.min(perStar * lv, cap);
    return node(
      label("Card", id),
      val,
      [
        node("Card Qty", qty, null, { fmt: "raw" }),
        node("Card Lv", lv, null, { fmt: "raw" }),
        node("Per Star", perStar, null, { fmt: "raw" }),
        node("Cap", cap, null, { fmt: "raw" }),
        node(val >= cap ? "CAPPED" : "Uncapped", val, null, { fmt: "raw" }),
      ],
      { fmt: "+" }
    );
  },
};

// Cavern cave-cards Drop Rate (additive). N.js (Drop_Rarity formula):
//   Math.min(4*CardLv("caveC") + 6*CardLv("caveD"), 100)
// caveC (Cavern 16) and caveD (Cavern 18 Crystal Glunko, added 2026-06) SHARE a
// single cap of 100 — so they can't be modeled as two independent cardSingle
// entries (each would cap separately). One combined node matches the game.
export const caveDropCards = {
  resolve(_id: unknown, ctx: Ctx): ArkhNode {
    const cVal = 4 * computeCardLv("caveC", ctx.saveData);
    const dVal = 6 * computeCardLv("caveD", ctx.saveData);
    const val = Math.min(cVal + dVal, 100);
    // Name contains "(Card " so categorize.ts buckets it under 🃏 Cards
    // (matching the other cave/cardSingle DR sources it replaced).
    return node(
      "Cave Drop Rate (Card caveC+caveD)",
      val,
      [
        node("caveC (×4)", cVal, null, { fmt: "raw" }),
        node("caveD (×6)", dVal, null, { fmt: "raw" }),
        node(val >= 100 ? "CAPPED (100)" : "Uncapped", val, null, { fmt: "raw" }),
      ],
      { fmt: "+" }
    );
  },
};

// ==================== CARD SET BONUS ====================

export function computeCardSetBonus(charIdx: number, setKey: string): TreeResult {
  const csetMap = (csetEqData as any) && (csetEqData as any)[charIdx];
  if (!csetMap || typeof csetMap !== "object") return treeResult(0);
  const key = (IDforCardSETbonus as any)[setKey];
  if (!key) return treeResult(0);
  const val = Number(csetMap[key]) || 0;
  return treeResult(val, [
    node("Set " + setKey, val, null, { fmt: "raw", note: "key=" + key }),
  ]);
}

export function computeCardSetBonusRaw(setId: string | number, saveData: any): number {
  const cset = saveData.cardSetData;
  if (!cset) return 0;
  return Number(cset[setId]) || 0;
}

export function countDiscoveredCards(saveData: any): number {
  const cards1 = saveData.cardsData && saveData.cardsData[1];
  if (!cards1) return 0;
  let count = 0;
  for (let setIdx = 82; setIdx <= 86; setIdx++) {
    const set = (RANDOlist as any)[setIdx];
    if (!set) continue;
    for (let j = 0; j < set.length; j++) {
      if (cards1[set[j]] !== undefined) count++;
    }
  }
  return count;
}
