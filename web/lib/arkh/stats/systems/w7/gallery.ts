// ===== GALLERY SYSTEM (W7) =====
// 1:1 port of corgan-source/js/stats/systems/w7/gallery.js.
// Nametag / Trophy / PremHat (Hatrack) bonuses driven by Spelunk[16/17/46],
// gallery level, podiums, chips, bubbles, etc.

import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData, numCharacters, labData, klaData } from "../../../save/data";
import { ITEMS } from "../../data/game/items.js";
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
import { companionChild, companions } from "../common/companions";
import { GALLERY_TROPH_CHIP_MULTI } from "../../data/game-constants";
import { bubbleBonusY13 } from "../w2/alchemy";
import { charHasChip } from "../w4/lab";
import type { SaveData } from "../../../state";

type GalleryOpts = {
  // Chip 16 (Silkrode Motherboard) contributes +10 to the Gallery Bonus Multi
  // sum (=+0.10 to multi). N.js GalleryBonusMulti reads
  // 10 × chipBonuses("troph") for the CURRENT player, i.e. whether the char
  // being computed has the chip in its lab slots — deterministic from the
  // save. `chipGalleryActive` is an explicit override (UI toggle, observed-max
  // collector); when undefined the resolver detects the chip on `charIdx`
  // (or on any char when no charIdx is known — legacy entry points).
  chipGalleryActive?: boolean;
  charIdx?: number;
};

type Ctx = { saveData: SaveData; charIdx?: number; chipGalleryActive?: boolean };
type MultiResult = { val: number; children: ArkhNode[] };

export const CHIP_GALLERY_BOOST = 10; // +10 to additive sum (=> +0.10 to multi)

/** Returns true if chip 16 (Silkrode Motherboard) is in any character's lab
 *  slot. Used as the canonical Arkh/IT detection for the chip's Gallery
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
  // Chip 16 contribution — see GalleryOpts. Verified against the live game
  // (2026-09-18): every ARKHE char wears chip 16 and the game's gallery
  // multi is 2.27, not 2.17.
  const trophChip =
    opts?.chipGalleryActive !== undefined
      ? opts.chipGalleryActive
        ? 1
        : 0
      : opts?.charIdx !== undefined && opts.charIdx >= 0
        ? charHasChip(opts.charIdx, "troph")
          ? 1
          : 0
        : detectChip16(saveData)
          ? 1
          : 0;
  const y13capped = Math.min(20, bubbleBonusY13(saveData));
  const cardLv = Math.min(computeCardLv("w7a11", saveData), 10);
  // Bubba The Seal: +30 → +50 at stage 2 (LV2) — scales every nametag/trophy.
  const comp49 =
    saveData.companionIds && saveData.companionIds.has(49)
      ? companionBonus(49, saveData.companionLv2Ids)
      : 0;
  const clamWork7 = (Number((optionsListData as any)[464]) || 0) > 7 ? 1 : 0;
  const ola467 = Number((optionsListData as any)[467]) || 0;
  const killroy3 = (ola467 / (200 + ola467)) * 10;
  // IT source: sushiBonus54 — "+{% Gallery Bonus Multi" (RoG_BonusQTY at index 54).
  // Arkh compute is missing this, which causes ~+1 to sum (=> +0.01 multi) when
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
  const ch: ArkhNode[] = [];
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

// @njs HatrackBonusMulti
export function hatrackBonusMulti(saveData: SaveData): MultiResult {
  const sp = saveData.spelunkData || [];
  const hatCount = (sp[46] && (sp[46] as any[]).length) || 0;
  const mineFloor = Number((saveData.stateR7 as any)?.[4]) || 0;
  const mhq21 = mineheadBonusQTY(21, mineFloor);
  const evStr = saveData.cachedEventShopStr || "";
  const evShop30 = eventShopOwned(30, evStr);
  const sushiRoG36 = rogBonusQTY(36, saveData.cachedUniqueSushi || 0);
  // Pet2 (Companion 31, "+{15% Hat Rack Bonus Multi") — activated in the 2026-06
  // Summer Event (was the "Bababooey!" placeholder). N.js folds Companions(31)
  // straight into the sum: 1 + (hats + Companions(31) + 10·evShop30 + …)/100.
  const comp31 =
    saveData.companionIds && saveData.companionIds.has(31)
      ? companionBonus(31, saveData.companionLv2Ids)
      : 0;
  const sum = hatCount + comp31 + 10 * evShop30 + mhq21 + sushiRoG36;
  const val = 1 + sum / 100;
  const ch: ArkhNode[] = [];
  if (hatCount > 0) ch.push(node("Hats Owned", hatCount, null, { fmt: "raw" }));
  if (comp31 > 0)
    ch.push(
      node(label("Companion", 31), comp31, null, {
        fmt: "raw",
        note: "Hat Rack Bonus Multi",
      })
    );
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

// @njs PodiumsOwned_Lv4
function podiumsOwnedLv4(saveData: SaveData): number {
  const sail33 = Number(
    (saveData.sailingData &&
      saveData.sailingData[3] &&
      saveData.sailingData[3][33]) ||
      0
  );
  const comp28 =
    saveData.companionIds && saveData.companionIds.has(28) ? 1 : 0;
  // Companion 28 at stage 2 (LV2) counts as one more Lv4 podium (2026-08).
  const comp28Lv2 = saveData.companionLv2Ids?.has(28) ? 1 : 0;
  const evStr = saveData.cachedEventShopStr || "";
  const evShop29 = eventShopOwned(29, evStr);
  // 2026-10-16: artifact 33 at the new tier 7 (Verisimilitude) adds one more
  // podium, and so does owning the `ban_m` bundle (Have_ban_m).
  const banM = Number((saveData.bundlesData as any)?.ban_m) === 1 ? 1 : 0;
  return Math.round(
    Math.min(1, comp28) +
      Math.min(1, comp28Lv2) +
      evShop29 +
      Math.min(1, Math.floor(sail33 / 6)) +
      Math.min(1, Math.floor(sail33 / 7)) +
      banM
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

export function podiumsOwnedLv2(saveData: SaveData): number {
  const gem40 = Number((saveData.gemItemsData && saveData.gemItemsData[40]) || 0);
  const sail33 = Number(
    (saveData.sailingData &&
      saveData.sailingData[3] &&
      saveData.sailingData[3][33]) ||
      0
  );
  // N.js PodiumsOwned_Lv2 adds Companions(42) itself: CompanionDB[42][2] = 2
  // showcases (3 at stage 2), not a 0/1 flag.
  const comp42 =
    saveData.companionIds && saveData.companionIds.has(42)
      ? companionBonus(42, saveData.companionLv2Ids)
      : 0;
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
  resolve(id: number | (number | string)[], ctx: Ctx): ArkhNode {
    const map = statNameMapFor(id);
    if (!Object.keys(map).length)
      return node("Nametag " + id, 0, null, { note: "nametag " + id });
    const saveData = ctx.saveData;
    const sp = saveData.spelunkData || [];
    const levels = (sp[17] || []) as any[];
    const gbmObj = galleryBonusMulti(saveData, {
      chipGalleryActive: ctx.chipGalleryActive,
      charIdx: ctx.charIdx,
    });
    const gbm = gbmObj.val;
    let total = 0;
    const children: ArkhNode[] = [];
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
        // Named by IDENTITY (no "Level N" suffix) so the node path is stable
        // whether or not a given player owns it — the top-player reference
        // collector keys by path, so a level-in-the-name would fragment the
        // reference per level and leave unowned/lower-tier rows comparing
        // against 0 instead of the max achievable. Level lives in a child.
        children.push(
          node(
            tagName,
            val,
            [
              node("Level", lv, null, { fmt: "raw" }),
              node("Tier", tier, null, { fmt: "x" }),
              node("Gallery Bonus Multi", gbm, gbmObj.children, { fmt: "x" }),
              node("Base", drEntries[j].val, null, { fmt: "raw" }),
            ],
            { fmt: "+", note: "gallery level " + lv }
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
  resolve(id: number | (number | string)[], ctx: Ctx): ArkhNode {
    const map = statNameMapFor(id);
    if (!Object.keys(map).length)
      return node("Trophy " + id, 0, null, { note: "trophy " + id });
    const saveData = ctx.saveData;
    const sp = saveData.spelunkData || [];
    const trophySlots = (sp[16] || []) as any[];
    const gbmObj = galleryBonusMulti(saveData, {
      chipGalleryActive: ctx.chipGalleryActive,
      charIdx: ctx.charIdx,
    });
    const gbm = gbmObj.val;
    let total = 0;
    const children: ArkhNode[] = [];
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
        // Named by IDENTITY (no "slot N" suffix) — same reasoning as
        // nametags: a stable path lets the top-player reference aggregate by
        // trophy across players (and slots/tiers), so the 🎯 shows the max
        // achievable even for trophies you don't own. Slot lives in a child.
        children.push(
          node(
            tName,
            val,
            [
              node("Slot", i, null, { fmt: "raw" }),
              node("Tier", tier, null, { fmt: "x" }),
              node("Gallery Bonus Multi", gbm, gbmObj.children, { fmt: "x" }),
              node("Base", drEntries[j].val, null, { fmt: "raw" }),
            ],
            { fmt: "+", note: "gallery slot " + i }
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
  resolve(id: number | (number | string)[], ctx: Ctx): ArkhNode {
    const map = statNameMapFor(id);
    if (!Object.keys(map).length)
      return node("Hatrack " + id, 0, null, { note: "premhat " + id });
    const saveData = ctx.saveData;
    const sp = saveData.spelunkData || [];
    // TotalStats adds PremHatBonTOT only while PremHatBonusesSystemON.
    const on = ctx.charIdx != null && premhatSystemOn(ctx.charIdx);
    const hats = (on ? sp[46] || [] : []) as any[];
    const hbmObj = hatrackBonusMulti(saveData);
    const hbm = hbmObj.val;
    let total = 0;
    const children: ArkhNode[] = [];
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

// ===== THE CAPE VINE (2026-11-01, World 4) =====
// Capes deposited in the vine (Spelunk[54]: cape item names in slot order)
// give their bonuses account-wide, and a worn cape (EquipOrder row 0, slot 12)
// no longer counts once the system is ON. Same shape as the Hat Rack above:
// UQ stats feed every EtcBonuses(...), base stats feed TotalStats(stat).
// N.js OnPlayStart4 pushes an empty Spelunk[54] into pre-update saves, so a
// missing entry reads as "no capes deposited".

/** KillsLeft2Advance[map][0] <= 0 for the character (the current one in N.js).
 *  Towns have no kill requirement, so a town check is ON in practice. */
function noKillsLeft(charIdx: number, map: number): boolean {
  const row = (klaData as any[])[charIdx]?.[map];
  // ponytail: no KLA row (synthetic / partial save) reads as OFF; N.js would
  // throw there. Real saves always carry KLA_N.
  return Array.isArray(row) && (Number(row[0]) || 0) <= 0;
}

/** N.js Gallery("PremHatBonusesSystemON") @11144301: map 50 (W2 town). */
// @njs PremHatBonusesSystemON
export function premhatSystemOn(charIdx: number): boolean {
  return noKillsLeft(charIdx, 50);
}

/** N.js Gallery("CapevineBonusesSystemON") @11146683: map 100 (W3 town). */
// @njs CapevineBonusesSystemON
export function capevineSystemOn(charIdx: number): boolean {
  return noKillsLeft(charIdx, 100);
}

/** N.js Stuff2("GoldCapeVinesOwned") = round(1 + OLA[669] + 3·Have_ban_o). */
// @njs _customBlock_Stuff2
// @njs Have_ban_o
export function goldCapeVinesOwned(s: SaveData): number {
  const banO = Number((s.bundlesData as any)?.ban_o) === 1 ? 1 : 0;
  return Math.round(1 + (Number((optionsListData as any)[669]) || 0) + 3 * banO);
}

function vineCapes(s: SaveData): string[] {
  return ((s.spelunkData || [])[54] || []) as string[];
}

/** N.js Gallery("CapevineBonusMulti", n): vine slot n is golden (full bonus)
 *  when n < GoldCapeVinesOwned, else 25% (Catherine's text says 20%; the code
 *  says .25). Both scale with +1% per cape deposited and Companions(105). */
// @njs CapevineBonusMulti
export function capevineBonusMulti(n: number, s: SaveData): number {
  const m = 1 + (vineCapes(s).length + companions(105, s)) / 100;
  return goldCapeVinesOwned(s) > n || n === 999 ? m : 0.25 * m;
}

function capevineMultiNode(n: number, s: SaveData): ArkhNode {
  const golden = goldCapeVinesOwned(s) > n;
  const comp105 = companions(105, s);
  const ch: ArkhNode[] = [
    node("Capes in the Vine", vineCapes(s).length, null, { fmt: "raw", note: "+1% each" }),
  ];
  if (comp105 > 0)
    ch.push(node(label("Companion", 105), comp105, null, { fmt: "raw", note: "Cape Vine Bonus Multi" }));
  if (!golden)
    ch.push(node("Regular Vine", 0.25, null, { fmt: "x", note: "Only Golden Vine slots give the full bonus" }));
  return node("Cape Vine Bonus Multi", capevineBonusMulti(n, s), ch, { fmt: "x" });
}

const CAPE_BASE_STATS = ["Weapon_Power", "STR", "AGI", "WIS", "LUK", "Defence"];

type VineUq = { n: number; cape: string; name: string; txt: string; base: number; val: number };

/** InitializeCapeBonuses' UQ loop, one line per (cape, UQ1/UQ2) — the single
 *  source for both CapeVineBonTOT and the EtcBonuses node. */
function vineUqs(s: SaveData): VineUq[] {
  const out: VineUq[] = [];
  const capes = vineCapes(s);
  for (let n = 0; n < capes.length; n++) {
    const item = (ITEMS as any)[capes[n]];
    if (!item) continue;
    const m = capevineBonusMulti(n, s);
    for (const u of [1, 2]) {
      const txt = item["UQ" + u + "txt"];
      if (!txt || txt === "0") continue;
      const base = Number(item["UQ" + u + "val"]) || 0;
      const name = String(item.displayName || capes[n]).replace(/[|_]/g, " ");
      out.push({ n, cape: capes[n], name, txt, base, val: m * base });
    }
  }
  return out;
}

/** N.js Gallery("InitializeCapeBonuses") → DNSM.CapeVineBonTOT. */
// @njs InitializeCapeBonuses
export function capeVineBonTot(s: SaveData): Record<string, number> {
  const tot: Record<string, number> = {};
  const capes = vineCapes(s);
  if (!capes.length) return tot;
  // UQ lines first, then the base-stat overwrite: N.js interleaves them per
  // cape, which only differs if a UQ were named like a base stat (none is).
  for (const q of vineUqs(s)) tot[q.txt] = (tot[q.txt] || 0) + q.val;
  // PremHatBonTOT[stat] for the six base stats (InitializePremHatBonuses).
  const hbm = hatrackBonusMulti(s).val;
  const hatStat: Record<string, number> = {};
  for (const st of CAPE_BASE_STATS) {
    let sum = 0;
    for (const hat of ((s.spelunkData || [])[46] || []) as string[])
      sum += hbm * (Number((ITEMS as any)[hat]?.[st]) || 0);
    hatStat[st] = sum;
  }
  for (let n = 0; n < capes.length; n++) {
    const item = (ITEMS as any)[capes[n]];
    if (!item) continue;
    const m = capevineBonusMulti(n, s);
    // The game's own behaviour, ported literally: the six base stats are
    // OVERWRITTEN per cape (not summed) and start from PremHatBonTOT[stat] —
    // the block was copied from InitializePremHatBonuses and still reads the
    // hats' map. Net: the LAST cape's stats × its multi + the Hat Rack's stats
    // a second time (TotalStats also adds PremHatBonTOT itself).
    for (const st of CAPE_BASE_STATS) tot[st] = hatStat[st] + m * (Number(item[st]) || 0);
  }
  return tot;
}

export const capevine = {
  resolve(id: number | (number | string)[], ctx: Ctx): ArkhNode {
    const map = statNameMapFor(id);
    const s = ctx.saveData;
    let total = 0;
    const children: ArkhNode[] = [];
    if (Object.keys(map).length && ctx.charIdx != null && capevineSystemOn(ctx.charIdx)) {
      for (const q of vineUqs(s)) {
        if (!map[q.txt]) continue;
        total += q.val;
        children.push(
          node(
            q.name,
            q.val,
            [capevineMultiNode(q.n, s), node("Base", q.base, null, { fmt: "raw" })],
            {
              fmt: "+",
              note: (goldCapeVinesOwned(s) > q.n ? "Golden Vine" : "Vine") + " slot " + (q.n + 1),
            }
          )
        );
      }
    }
    return node("Cape Vine Bonuses", total, children, { fmt: "+", note: "capevine " + id });
  },
};
