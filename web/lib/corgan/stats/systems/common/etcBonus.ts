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
    // Include sub-nodes even when val=0: the equipment resolver now appends
    // a catalog of all DR-capable items that aren't currently equipped, so
    // the user sees "what they could equip" alongside what they have. Hide
    // the zero rows for nametag/trophy/premhat (no catalog there yet) to
    // keep the tree focused.
    const hasChildren = (n: CorganNode) => !!(n.children && n.children.length);
    if (eqNode.val || hasChildren(eqNode)) children.push(eqNode);
    if (obNode.val || hasChildren(obNode)) children.push(obNode);
    if (ntNode.val) children.push(ntNode);
    if (trNode.val) children.push(trNode);
    if (phNode.val) children.push(phNode);
    return node("EtcBonuses(" + id + ")", total, children, {
      fmt: "+",
      note: "etcBonus " + id,
    });
  },
};
