// ===== GALLERY SYSTEM (W7) =====
// 1:1 port of corgan-source/js/stats/systems/w7/gallery.js.
// Nametag / Trophy / PremHat (Hatrack) bonuses driven by Spelunk[16/17/46],
// gallery level, podiums, chips, bubbles, etc.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData, numCharacters, labData } from "../../../save/data";
import { computeCardLv } from "../common/cards";
import { NAMETAG_TIER_SCALE } from "../../data/common/nametag";
import {
  NAMETAG_DR,
  NAMETAG_NAMES,
  TROPHY_DR,
  TROPHY_NAMES,
  PREMHAT_DR,
  PREMHAT_NAMES,
  GALLERY_STAT_FOR_ID,
} from "../../data/w7/gallery";
import { mineheadBonusQTY } from "./minehead";
import { rogBonusQTY } from "./sushi";
import { legendPTSbonus } from "./spelunking";
import { eventShopOwned, emporiumBonus } from "../../../game-helpers";
import { companionBonus } from "../../data/common/companions";
import { GALLERY_TROPH_CHIP_MULTI } from "../../data/game-constants";
import { bubbleBonusY13 } from "../w2/alchemy";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };
type MultiResult = { val: number; children: CorganNode[] };

export function galleryBonusMulti(saveData: SaveData): MultiResult {
  const sp = saveData.spelunkData || [];
  const galleryLv = Number((sp[13] && sp[13][4]) || 0);
  let trophChip = 0;
  if (labData) {
    for (let ci = 0; ci < numCharacters; ci++) {
      const chipSlots = (labData as any)[1 + ci];
      if (!chipSlots) continue;
      for (let s = 0; s < 7; s++) {
        if (Number(chipSlots[s]) === 16) {
          trophChip = 1;
          break;
        }
      }
      if (trophChip) break;
    }
  }
  const y13capped = Math.min(20, bubbleBonusY13(saveData));
  const cardLv = Math.min(computeCardLv("w7a11", saveData), 10);
  const comp49 =
    saveData.companionIds && saveData.companionIds.has(49)
      ? companionBonus(49)
      : 0;
  const clamWork7 = (Number((optionsListData as any)[464]) || 0) > 7 ? 1 : 0;
  const ola467 = Number((optionsListData as any)[467]) || 0;
  const killroy3 = (ola467 / (200 + ola467)) * 10;
  const sum =
    3 * galleryLv +
    GALLERY_TROPH_CHIP_MULTI * trophChip +
    3 * clamWork7 +
    killroy3 +
    y13capped +
    cardLv +
    comp49;
  const val = 1 + sum / 100;
  const ch: CorganNode[] = [];
  if (galleryLv > 0)
    ch.push(
      node(
        "Gallery Level",
        3 * galleryLv,
        [node("Level", galleryLv, null, { fmt: "raw" })],
        { fmt: "raw", note: "3 per level" }
      )
    );
  if (trophChip)
    ch.push(
      node(label("Chip", 16), GALLERY_TROPH_CHIP_MULTI, null, {
        fmt: "raw",
        note: "chip 16",
      })
    );
  if (clamWork7)
    ch.push(node(label("ClamWork", 7), 3, null, { fmt: "raw" }));
  if (killroy3 > 0)
    ch.push(node(label("Killroy", 3), killroy3, null, { fmt: "raw" }));
  if (y13capped > 0)
    ch.push(
      node("Bubble Y13 (capped 20)", y13capped, null, {
        fmt: "raw",
        note: "kazam bubble 13",
      })
    );
  if (cardLv > 0)
    ch.push(node("Card w7a11 (capped 10)", cardLv, null, { fmt: "raw" }));
  if (comp49 > 0)
    ch.push(
      node(label("Companion", 49), comp49, null, {
        fmt: "raw",
        note: "companion 49",
      })
    );
  return { val, children: ch };
}

export function hatrackBonusMulti(saveData: SaveData): MultiResult {
  const sp = saveData.spelunkData || [];
  const hatCount = (sp[46] && (sp[46] as any[]).length) || 0;
  const mineFloor = Number((saveData.stateR7 as any)?.[4]) || 0;
  const mhq21 = mineheadBonusQTY(21, mineFloor);
  const evStr = saveData.cachedEventShopStr || "";
  const evShop30 = eventShopOwned(30, evStr);
  const sushiRoG36 = rogBonusQTY(36, saveData.cachedUniqueSushi || 0);
  const sum = hatCount + 10 * evShop30 + mhq21 + sushiRoG36;
  const val = 1 + sum / 100;
  const ch: CorganNode[] = [];
  if (hatCount > 0) ch.push(node("Hats Owned", hatCount, null, { fmt: "raw" }));
  if (evShop30 > 0)
    ch.push(node(label("Event", 30), 10 * evShop30, null, { fmt: "raw" }));
  if (mhq21 > 0)
    ch.push(
      node(label("Minehead Floor", 21), mhq21, null, {
        fmt: "raw",
        note: "minehead 21",
      })
    );
  if (sushiRoG36 > 0)
    ch.push(
      node(label("Sushi", 36), sushiRoG36, null, {
        fmt: "raw",
        note: "RoG_BonusQTY(36)",
      })
    );
  return { val, children: ch };
}

function podiumsOwnedLv4(saveData: SaveData): number {
  const sail33 = Number(
    (saveData.sailingData &&
      saveData.sailingData[3] &&
      saveData.sailingData[3][33]) ||
      0
  );
  const comp28 =
    saveData.companionIds && saveData.companionIds.has(28) ? 1 : 0;
  const evStr = saveData.cachedEventShopStr || "";
  const evShop29 = eventShopOwned(29, evStr);
  return Math.round(
    Math.min(1, comp28) + evShop29 + Math.min(1, Math.floor(sail33 / 6))
  );
}

function podiumsOwnedLv3(saveData: SaveData): number {
  const gem40 = Number((saveData.gemItemsData && saveData.gemItemsData[40]) || 0);
  const sail33 = Number(
    (saveData.sailingData &&
      saveData.sailingData[3] &&
      saveData.sailingData[3][33]) ||
      0
  );
  return Math.round(
    Math.floor(gem40 / 3) +
      Math.min(1, Math.floor(sail33 / 5)) +
      podiumsOwnedLv4(saveData)
  );
}

function podiumsOwnedLv2(saveData: SaveData): number {
  const gem40 = Number((saveData.gemItemsData && saveData.gemItemsData[40]) || 0);
  const sail33 = Number(
    (saveData.sailingData &&
      saveData.sailingData[3] &&
      saveData.sailingData[3][33]) ||
      0
  );
  const comp42 =
    saveData.companionIds && saveData.companionIds.has(42) ? 1 : 0;
  const clamWork0 = (Number((optionsListData as any)[464]) || 0) > 0 ? 1 : 0;
  const ola467 = Number((optionsListData as any)[467]) || 0;
  const killroy3 = (ola467 / (200 + ola467)) * 10;
  const legendPts9 = legendPTSbonus(9, saveData);
  const sailPart = Math.max(
    0,
    Math.min(2, Math.round(sail33) - 2) - Math.min(1, Math.floor(sail33 / 5))
  );
  return Math.round(
    2 * clamWork0 +
      Math.min(2, killroy3) +
      comp42 +
      Math.floor(gem40 / 2) +
      podiumsOwnedLv3(saveData) +
      legendPts9 +
      sailPart
  );
}

export function trophyTier(slotIndex: number, saveData: SaveData): number {
  if (slotIndex < 48) return 0.3;
  const offset = slotIndex - 48;
  if (podiumsOwnedLv4(saveData) > offset) return 2.5;
  if (podiumsOwnedLv3(saveData) > offset) return 2.0;
  if (podiumsOwnedLv2(saveData) > offset) return 1.5;
  return 1.0;
}

function statNameMapFor(id: number | (number | string)[]): Record<string, true> {
  const ids = Array.isArray(id) ? id : [id];
  const out: Record<string, true> = {};
  for (let si = 0; si < ids.length; si++) {
    const s = GALLERY_STAT_FOR_ID[String(ids[si])];
    if (s) out[s] = true;
  }
  return out;
}

export const nametag = {
  resolve(id: number | (number | string)[], ctx: Ctx): CorganNode {
    const map = statNameMapFor(id);
    if (!Object.keys(map).length)
      return node("Nametag " + id, 0, null, { note: "nametag " + id });
    const saveData = ctx.saveData;
    const sp = saveData.spelunkData || [];
    const levels = (sp[17] || []) as any[];
    const gbmObj = galleryBonusMulti(saveData);
    const gbm = gbmObj.val;
    let total = 0;
    const children: CorganNode[] = [];
    for (let i = 0; i < levels.length; i++) {
      const lv = Number(levels[i]) || 0;
      if (lv < 1) continue;
      const drEntries = NAMETAG_DR[i];
      if (!drEntries) continue;
      const tier = NAMETAG_TIER_SCALE[Math.min(4, lv - 1)];
      for (let j = 0; j < drEntries.length; j++) {
        if (!map[drEntries[j].stat]) continue;
        const val = tier * gbm * drEntries[j].val;
        total += val;
        const tagName = NAMETAG_NAMES[i] || "Tag #" + i;
        children.push(
          node(
            tagName + " Level " + lv,
            val,
            [
              node("Tier", tier, null, { fmt: "x" }),
              node("Gallery Bonus Multi", gbm, gbmObj.children, { fmt: "x" }),
              node("Base", drEntries[j].val, null, { fmt: "raw" }),
            ],
            { fmt: "+" }
          )
        );
      }
    }
    return node("Nametag Bonuses", total, children, {
      fmt: "+",
      note: "nametag " + id,
    });
  },
};

export const trophy = {
  resolve(id: number | (number | string)[], ctx: Ctx): CorganNode {
    const map = statNameMapFor(id);
    if (!Object.keys(map).length)
      return node("Trophy " + id, 0, null, { note: "trophy " + id });
    const saveData = ctx.saveData;
    const sp = saveData.spelunkData || [];
    const trophySlots = (sp[16] || []) as any[];
    const gbmObj = galleryBonusMulti(saveData);
    const gbm = gbmObj.val;
    let total = 0;
    const children: CorganNode[] = [];
    for (let i = 0; i < trophySlots.length; i++) {
      const trophyId = Number(trophySlots[i]) || 0;
      if (trophyId < 1) continue;
      const drEntries = TROPHY_DR[trophyId];
      if (!drEntries) continue;
      const tier = trophyTier(i, saveData);
      for (let j = 0; j < drEntries.length; j++) {
        if (!map[drEntries[j].stat]) continue;
        const val = tier * gbm * drEntries[j].val;
        total += val;
        const tName = TROPHY_NAMES[trophyId] || "Trophy" + trophyId;
        children.push(
          node(
            tName + " slot " + i,
            val,
            [
              node("Tier", tier, null, { fmt: "x" }),
              node("Gallery Bonus Multi", gbm, gbmObj.children, { fmt: "x" }),
              node("Base", drEntries[j].val, null, { fmt: "raw" }),
            ],
            { fmt: "+" }
          )
        );
      }
    }
    return node("Trophy Bonuses", total, children, {
      fmt: "+",
      note: "trophy " + id,
    });
  },
};

export const premhat = {
  resolve(id: number | (number | string)[], ctx: Ctx): CorganNode {
    const map = statNameMapFor(id);
    if (!Object.keys(map).length)
      return node("Hatrack " + id, 0, null, { note: "premhat " + id });
    const saveData = ctx.saveData;
    const sp = saveData.spelunkData || [];
    const hats = (sp[46] || []) as any[];
    const hbmObj = hatrackBonusMulti(saveData);
    const hbm = hbmObj.val;
    let total = 0;
    const children: CorganNode[] = [];
    for (let i = 0; i < hats.length; i++) {
      const hatName = hats[i];
      if (!hatName || typeof hatName !== "string") continue;
      const drEntries = PREMHAT_DR[hatName];
      if (!drEntries) continue;
      for (let j = 0; j < drEntries.length; j++) {
        if (!map[drEntries[j].stat]) continue;
        const val = hbm * drEntries[j].val;
        total += val;
        children.push(
          node(
            PREMHAT_NAMES[hatName] || hatName,
            val,
            [
              node("Hatrack Bonus Multi", hbm, hbmObj.children, { fmt: "x" }),
              node("Base", drEntries[j].val, null, { fmt: "raw" }),
            ],
            { fmt: "+" }
          )
        );
      }
    }
    // Suppress unused-var warning for emporiumBonus (referenced symbol present
    // for parity with corgan-source's import list).
    void emporiumBonus;
    return node("Hatrack Bonuses", total, children, {
      fmt: "+",
      note: "premhat " + id,
    });
  },
};
