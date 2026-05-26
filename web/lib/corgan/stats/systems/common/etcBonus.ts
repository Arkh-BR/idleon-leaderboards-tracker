// ===== ETC BONUS SYSTEM =====
// 1:1 port of corgan-source/js/stats/systems/common/etcBonus.js.
//
// In-game, EtcBonuses(X) is one total across ALL gear sources, applied as a
// single (1 + total/100) multiplier. We sum equipment + obol + nametag +
// trophy + premhat for the requested stat id.

import { node, type CorganNode } from "../../../node";
import { equipment } from "./equipment";
import { obol } from "../w2/obols";
import { nametag, trophy, premhat } from "../w7/gallery";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

// Friendly labels for the etcBonus stat IDs that feed the DR descriptor.
// These mirror the stat strings in custommaps.IDforETCbonus — id 2 maps to
// %_DROP_RATE, 99 to %_BONUS_DROP_RATE, etc. — and turn the bare
// "EtcBonuses(99)" wrapper into "Bonus Drop Rate (Gear)" so the user sees
// at a glance what the multiplier is for.
const ETCBONUS_LABELS: Record<string, string> = {
  "2": "Drop Rate (Gear)",
  "99": "Bonus Drop Rate (Gear)",
  "102": "Drop Chance (Gear)",
  "91": "Drop Rate Multi (Gear)",
};

// Long-form descriptions for the empty-state placeholder. id 102's stat
// (%_DROP_CHANCE) has no items in IT website-data that carry it as a
// built-in — players can only get it by rolling that stat as a UQ on a
// random-stone — so the wrapper sits empty unless the save has such a
// roll. Spelling that out beats showing a silent zero row.
const EMPTY_NOTES: Record<string, string> = {
  "102":
    "No items carry +Drop Chance as a built-in stat — only granted by random UQ rolls on items / obols",
};

function etcBonusLabel(id: number | (number | string)[]): string {
  const key = Array.isArray(id) ? id.join(",") : String(id);
  return ETCBONUS_LABELS[key] || "EtcBonuses(" + key + ")";
}

export const etcBonus = {
  resolve(id: number | (number | string)[], ctx: Ctx): CorganNode {
    const eqNode = equipment.resolve(id, ctx);
    const obNode = obol.resolve(id, ctx);
    const ntNode = nametag.resolve(typeof id === "number" ? id : 0, ctx);
    const trNode = trophy.resolve(typeof id === "number" ? id : 0, ctx);
    const phNode = premhat.resolve(typeof id === "number" ? id : 0, ctx);
    const total =
      (eqNode.val || 0) +
      (obNode.val || 0) +
      (ntNode.val || 0) +
      (trNode.val || 0) +
      (phNode.val || 0);
    const children: CorganNode[] = [];
    // Include sub-nodes even when val=0: the equipment / obol / nametag /
    // trophy resolvers each now append a catalog of DR-capable entries the
    // user hasn't acquired yet, so the visible-or-not decision needs to look
    // at the subtree rather than the wrapper's total alone. Premhat doesn't
    // carry a catalog yet so we still gate it on val.
    const hasChildren = (n: CorganNode) => !!(n.children && n.children.length);
    if (eqNode.val || hasChildren(eqNode)) children.push(eqNode);
    if (obNode.val || hasChildren(obNode)) children.push(obNode);
    if (ntNode.val || hasChildren(ntNode)) children.push(ntNode);
    if (trNode.val || hasChildren(trNode)) children.push(trNode);
    if (phNode.val) children.push(phNode);

    // Keep the canonical id tag in the name so the existing entity-tag
    // splitter in DeepView mutes it (label() does the same thing for
    // talents / stamps / cards). Result: "Drop Rate (Gear)  (etcBonus 2)".
    const idStr = Array.isArray(id) ? id.join(",") : String(id);

    // If every sub-resolver returned empty, emit a single placeholder child
    // explaining WHY the wrapper is empty rather than leaving the user to
    // wonder. This is currently the etcBonus(102) case — DROP_CHANCE has no
    // built-in carriers anywhere in IT website-data.
    if (children.length === 0) {
      const note =
        EMPTY_NOTES[idStr] ||
        "No active sources for this stat on the current character";
      children.push(node("No active sources", 0, null, { fmt: "+", note }));
    }

    return node(
      `${etcBonusLabel(id)} (etcBonus ${idStr})`,
      total,
      children,
      { fmt: "+" }
    );
  },
};
