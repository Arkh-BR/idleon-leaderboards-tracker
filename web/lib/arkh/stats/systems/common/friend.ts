// ===== FRIEND SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/friend.js.
//
// Friend bonus stats from the Thingies system. Game stores entries as a
// semi-colon-separated string at optionsListData[476]; each entry is
// "type,score,name". For each type the LAST entry with count > 0 wins.

import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData } from "../../../save/data";
import { FRIEND_DR } from "../../data/game-constants";
import { eventShopOwned } from "../../../game-helpers";
import { companionChild } from "./companions";
import { companionBonus } from "../../data/common/companions";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const FRIEND_SCALE: Record<number, number> = {
  0: 100,
  1: 30,
  2: 50,
  3: 25,
  4: 30,
  5: 40,
  6: 10, // Extra Kills — added in the 2026-06 Summer Event (not a DR source)
};

/** Owned companion's bonus VALUE (stage 2 aware), 0 when not owned — what
 *  N.js `_customBlock_Companions(id)` returns. */
function compVal(id: number, saveData: SaveData): number {
  return saveData.companionIds && saveData.companionIds.has(id)
    ? companionBonus(id, saveData.companionLv2Ids)
    : 0;
}

// @njs FriendBonusSlots
// round(min(20, 2 + Companions(44) + 2·Companions(30) + EventShop 22)) — with
// Pet1 (30) at stage 2 its value is 1.5, i.e. +3 slots (its LV2 text).
function computeFriendBonusSlots(saveData: SaveData): number {
  const evShop22 = eventShopOwned(22, saveData.cachedEventShopStr || "");
  return Math.round(
    Math.min(20, 2 + compVal(44, saveData) + 2 * compVal(30, saveData) + evShop22)
  );
}

// @njs FriendBonusQTY
export const friend = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const friendStr = String((optionsListData as any)?.[476] ?? "");
    if (!friendStr || friendStr === "0")
      return node("Friend Bonus", 0, null, { note: "friend " + id });
    const entries = friendStr.split(";");
    const slots = computeFriendBonusSlots(ctx.saveData);
    const scale = FRIEND_SCALE[id] != null ? FRIEND_SCALE[id] : FRIEND_DR.scale;
    let lastContrib = 0;
    let lastChild: ArkhNode | null = null;
    const maxEntries = Math.min(slots, entries.length);
    for (let i = 0; i < maxEntries; i++) {
      const parts = entries[i].split(",");
      const type = parseInt(parts[0]);
      const count = parseInt(parts[1]);
      if (type !== id || !(type < 18)) continue;
      if (count > 0) {
        const c = Math.min(FRIEND_DR.cap, Math.max(0, count));
        lastContrib =
          scale *
          Math.min(
            FRIEND_DR.satCap,
            FRIEND_DR.base + (c / (c + FRIEND_DR.half)) * FRIEND_DR.mult
          );
        lastChild = node(
          parts[2] || "?",
          lastContrib,
          [node("Score", count, null, { fmt: "raw" })],
          { fmt: "+" }
        );
      } else {
        lastContrib = 0;
        lastChild = null;
      }
    }
    if (lastContrib <= 0)
      return node("Friend Bonus", 0, null, { note: "friend " + id });
    let total = lastContrib;
    const children: ArkhNode[] = [];
    if (lastChild) children.push(lastChild);
    // @njs FriendBonusXtraMulti
    // 1 + (100·Companions(30) + 25·CompLV2(44)) / 100 — Companions(30) is the
    // companion's VALUE (1 → ×2, 1.5 at stage 2 → ×2.5); the CompLV2(44) term
    // arrived with the 2026-08 update.
    const comp30 = compVal(30, ctx.saveData);
    const comp44Lv2 = ctx.saveData.companionLv2Ids?.has(44) ? 1 : 0;
    const xtra = 1 + (100 * comp30 + 25 * comp44Lv2) / 100;
    if (xtra !== 1) total *= xtra;
    if (comp30 > 0) {
      children.push(
        companionChild(30, 1 + comp30, ctx.saveData, {
          fmt: "x",
          note: "companion 30" + (comp30 > 1 ? " — stage 2 (LV2)" : ""),
        })
      );
    }
    if (comp44Lv2) {
      children.push(
        node("Companion 44 — Stage 2 (LV2)", 1.25, null, {
          fmt: "x",
          note: "+25% Friend Bonus multi",
        })
      );
    }
    return node("Friend Bonus", total, children, {
      fmt: "+",
      note: "friend " + id,
    });
  },
};
