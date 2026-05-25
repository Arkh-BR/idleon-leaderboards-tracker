// ===== GALLERY (STAGE 4 STUB) =====
// galleryBonusMulti, hatrackBonusMulti and trophyTier are read by stats.js
// (the lukScaling chain). Until stats.js is ported (Stage 5), the only
// places these are called are slot-by-slot helpers in stats; stubbing
// them to safe defaults (1.0 multiplier, tier 0) is enough.
//
// nametag/premhat/trophy resolvers are referenced by the registry but not
// by the DR descriptor — we keep the symbol shape but return zero nodes.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function galleryBonusMulti(_saveData: SaveData): { val: number } {
  return { val: 1 };
}

export function hatrackBonusMulti(_saveData: SaveData): { val: number } {
  return { val: 1 };
}

export function trophyTier(_slot: number, _saveData: SaveData): number {
  return 0;
}

export const trophy = {
  resolve(id: number, _ctx: Ctx): CorganNode {
    return node(label("Trophy", id), 0, null, { fmt: "+", note: "gallery stub" });
  },
};

export const nametag = {
  resolve(id: number, _ctx: Ctx): CorganNode {
    return node(label("Nametag", id), 0, null, { fmt: "+", note: "gallery stub" });
  },
};

export const premhat = {
  resolve(id: number, _ctx: Ctx): CorganNode {
    return node(label("Premhat", id), 0, null, { fmt: "+", note: "gallery stub" });
  },
};
