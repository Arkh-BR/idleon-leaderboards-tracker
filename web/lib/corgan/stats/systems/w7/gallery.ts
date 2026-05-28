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
import { ROG_DESC } from "../../data/w7/sushi";
import { legendPTSbonus } from "./spelunking";
import { eventShopOwned, emporiumBonus } from "../../../game-helpers";
import { companionBonus } from "../../data/common/companions";
import { companionChild } from "../common/companions";
import { GALLERY_TROPH_CHIP_MULTI } from "../../data/game-constants";
import { bubbleBonusY13 } from "../w2/alchemy";
import type { SaveData } from "../../../state";

type GalleryOpts = {
  // Chip 16 (Silkrode Motherboard) contributes +10 to the Gallery Bonus Multi
  // sum (=+0.10 to multi). In-game the gallery snapshot is cached at refresh
  // time, so the *current* save's labData state may not match what's
  // actually active in the gallery. Callers pass `chipGalleryActive` as the
  // source of truth (typically auto-derived from labData on save load, then
  // user-overridable via UI). When the flag is undefined we fall back to
  // detecting chip 16 in labData for backward compat.
  chipGalleryActive?: boolean;
};

type Ctx = { saveData: SaveData; chipGalleryActive?: boolean };
type MultiResult = { val: number; children: CorganNode[] };

export const CHIP_GALLERY_BOOST = 10; // +10 to additive sum (=> +0.10 to multi)

/** Returns true if chip 16 (Silkrode Motherboard) is in any character's lab
 *  slot. Used as the canonical Corgan/IT detection for the chip's Gallery
 *  Bonus Multi contribution. Callers can pass this through the
 *  `chipGalleryActive` opt to make the contribution explicit/togglable. */
export function detectChip16(saveData: SaveData): boolean {
  if (!labData) return false;
  for (let ci = 0; ci < numCharacters; ci++) {
    const chipSlots = (labData as any)[1 + ci];
    if (!chipSlots) continue;
    for (let s = 0; s < 7; s++) {
      if (Number(chipSlots[s]) === 16) return true;
    }
  }
  return false;
}

export function galleryBonusMulti(
  saveData: SaveData,
  opts?: GalleryOpts
): MultiResult {
  const sp = saveData.spelunkData || [];
  const galleryLv = Number((sp[13] && sp[13][4]) || 0);
  // Chip 16 contribution. The caller's `chipGalleryActive` is the source of
  // truth (UI auto-fills it from labData and lets the user override). When
  // not provided, fall back to direct labData detection so older entry
  // points still work.
  const trophChip =
    opts?.chipGalleryActive === undefined
      ? (detectChip16(saveData) ? 1 : 0)
      : opts.chipGalleryActive
      ? 1
      : 0;
  const y13capped = Math.min(20, bubbleBonusY13(saveData));
  const cardLv = Math.min(computeCardLv("w7a11", saveData), 10);
  const comp49 =
    saveData.companionIds && saveData.companionIds.has(49)
      ? companionBonus(49)
      : 0;
  const clamWork7 = (Number((optionsListData as any)[464]) || 0) > 7 ? 1 : 0;
  const ola467 = Number((optionsListData as any)[467]) || 0;
  const killroy3 = (ola467 / (200 + ola467)) * 10;
  // IT source: sushiBonus54 — "+{% Gallery Bonus Multi" (RoG_BonusQTY at index 54).
  // Corgan compute is missing this, which causes ~+1 to sum (=> +0.01 multi) when
  // uniqueSushi > 54. Affects every nametag/trophy proportionally.
  const sushi54 = rogBonusQTY(54, saveData.cachedUniqueSushi || 0);
  const sum =
    3 * galleryLv +
    GALLERY_TROPH_CHIP_MULTI * trophChip +
    3 * clamWork7 +
    killroy3 +
    y13capped +
    cardLv +
    comp49 +
    sushi54;
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
      node(
        "Silkrode Motherboard (Chip 16)",
        GALLERY_TROPH_CHIP_MULTI,
        null,
        { fmt: "raw" }
      )
    );
  if (clamWork7)
    ch.push(
      node("Glasstic Brain (Clam Work 7)", 3, null, { fmt: "raw" })
    );
  if (killroy3 > 0)
    ch.push(
      node("Skull Shop Tier 3 (Killroy 3)", killroy3, null, { fmt: "raw" })
    );
  if (y13capped > 0)
    ch.push(
      node("Codfrey Rulz OK (Bubble Y13, capped 20)", y13capped, null, {
        fmt: "raw",
        note: "kazam bubble 13",
      })
    );
  if (cardLv > 0)
    ch.push(
      node("Coralcave Crab (Card w7a11, capped 10)", cardLv, null, {
        fmt: "raw",
      })
    );
  if (comp49 > 0)
    ch.push(companionChild(49, comp49, saveData, { fmt: "raw" }));
  if (sushi54 > 0)
    ch.push(
      node(
        "Dulce Vitiri (Sushi Tier 55) — Gallery Bonus Multi (RoG Bonus 54)",
        sushi54,
        null,
        { fmt: "raw" }
      )
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
    ch.push(
      node("Hatrack Boutique Bonus (Event Shop 30)", 10 * evShop30, null, {
        fmt: "raw",
      })
    );
  if (mhq21 > 0)
    ch.push(
      node("Hatrack Floor Bonus (Minehead 21)", mhq21, null, { fmt: "raw" })
    );
  if (sushiRoG36 > 0)
    ch.push(
      node(
        "Abalone Sashimi (Sushi Tier 37) — Hat Rack Multi (RoG Bonus 36)",
        sushiRoG36,
        null,
        { fmt: "raw" }
      )
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
    const gbmObj = galleryBonusMulti(saveData, {
      chipGalleryActive: !!ctx.chipGalleryActive,
    });
    const gbm = gbmObj.val;
    let total = 0;
    const children: CorganNode[] = [];
    const ownedIds = new Set<number>();
    for (let i = 0; i < levels.length; i++) {
      const lv = Number(levels[i]) || 0;
      if (lv < 1) continue;
      const drEntries = NAMETAG_DR[i];
      if (!drEntries) continue;
      ownedIds.add(i);
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

    // Catalog of nametags not yet placed in the gallery (Spelunk[17] level
    // either missing or 0). Every DR-relevant nametag shows up directly
    // alongside the equipped ones as a zero-val row — no extra grouping —
    // so the user sees the upgrade path in line with what they already have.
    const unowned: { id: number; name: string; baseVal: number }[] = [];
    for (const idxStr of Object.keys(NAMETAG_DR)) {
      const idx = Number(idxStr);
      if (ownedIds.has(idx)) continue;
      const drEntries = NAMETAG_DR[idx];
      if (!drEntries) continue;
      for (const entry of drEntries) {
        if (!map[entry.stat]) continue;
        unowned.push({
          id: idx,
          name: NAMETAG_NAMES[idx] || "Tag #" + idx,
          baseVal: entry.val,
        });
      }
    }
    unowned.sort((a, b) => b.baseVal - a.baseVal);
    for (const u of unowned) {
      children.push(
        node(u.name, 0, null, {
          fmt: "+",
          note: `Not in gallery — base +${u.baseVal}, scales with Tier × Gallery Bonus Multi`,
        })
      );
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
    const gbmObj = galleryBonusMulti(saveData, {
      chipGalleryActive: !!ctx.chipGalleryActive,
    });
    const gbm = gbmObj.val;
    let total = 0;
    const children: CorganNode[] = [];
    const ownedTrophyIds = new Set<number>();
    for (let i = 0; i < trophySlots.length; i++) {
      const trophyId = Number(trophySlots[i]) || 0;
      if (trophyId < 1) continue;
      const drEntries = TROPHY_DR[trophyId];
      if (!drEntries) continue;
      ownedTrophyIds.add(trophyId);
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

    // Catalog of trophies the user hasn't earned + placed — every DR-
    // relevant trophy emits a zero-val row directly under the equipped
    // ones (no extra grouping). Stats are filtered against the requested
    // etcBonus id so DR-Multi trophies only show under stat 91, etc.
    const unowned: { id: number; name: string; baseVal: number }[] = [];
    for (const idStr of Object.keys(TROPHY_DR)) {
      const idx = Number(idStr);
      if (ownedTrophyIds.has(idx)) continue;
      const drEntries = TROPHY_DR[idx];
      if (!drEntries) continue;
      for (const entry of drEntries) {
        if (!map[entry.stat]) continue;
        unowned.push({
          id: idx,
          name: TROPHY_NAMES[idx] || "Trophy" + idx,
          baseVal: entry.val,
        });
      }
    }
    unowned.sort((a, b) => b.baseVal - a.baseVal);
    for (const u of unowned) {
      children.push(
        node(u.name, 0, null, {
          fmt: "+",
          note: `Not in gallery — base +${u.baseVal}, scales with Tier × Gallery Bonus Multi`,
        })
      );
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
