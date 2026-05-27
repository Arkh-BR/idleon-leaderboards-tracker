// ===== FRIEND SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/friend.js.
//
// Friend bonus stats from the Thingies system. Game stores entries as a
// semi-colon-separated string at optionsListData[476]; each entry is
// "type,score,name". For each type the LAST entry with count > 0 wins.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData } from "../../../save/data";
import { FRIEND_DR, COMPANION_BONUS } from "../../data/game-constants";
import { eventShopOwned } from "../../../game-helpers";
import { companionChild } from "./companions";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const FRIEND_SCALE: Record<number, number> = {
  0: 100,
  1: 30,
  2: 50,
  3: 25,
  4: 30,
  5: 40,
};

function computeFriendBonusSlots(saveData: SaveData): number {
  const comp44 = saveData.companionIds && saveData.companionIds.has(44) ? 1 : 0;
  const comp30 = saveData.companionIds && saveData.companionIds.has(30) ? 1 : 0;
  const evShop22 = eventShopOwned(22, saveData.cachedEventShopStr || "");
  return Math.round(Math.min(20, 2 + comp44 + 2 * comp30 + evShop22));
}

export const friend = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const friendStr = String((optionsListData as any)?.[476] ?? "");
    if (!friendStr || friendStr === "0")
      return node("Friend Bonus", 0, null, { note: "friend " + id });
    const entries = friendStr.split(";");
    const slots = computeFriendBonusSlots(ctx.saveData);
    const scale = FRIEND_SCALE[id] != null ? FRIEND_SCALE[id] : FRIEND_DR.scale;
    let lastContrib = 0;
    let lastChild: CorganNode | null = null;
    const maxEntries = Math.min(slots, entries.length);
    for (let i = 0; i < maxEntries; i++) {
      const parts = entries[i].split(",");
      const type = parseInt(parts[0]);
      const count = parseInt(parts[1]);
      if (type !== id || !(type < 18)) continue;
      if (count > 0) {
        const c = Math.min(FRIEND_DR.cap, Math.max(0, count));
        lastContrib =
          scale * Math.min(1, FRIEND_DR.base + c / (c + FRIEND_DR.half));
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
    const children: CorganNode[] = [];
    if (lastChild) children.push(lastChild);
    const comp30 = ctx.saveData.companionIds
      ? ctx.saveData.companionIds.has(30)
      : false;
    if (comp30) {
      total *= COMPANION_BONUS[30];
      children.push(
        companionChild(30, COMPANION_BONUS[30], ctx.saveData, {
          fmt: "x",
          note: "companion 30",
        })
      );
    }
    return node("Friend Bonus", total, children, {
      fmt: "+",
      note: "friend " + id,
    });
  },
};
