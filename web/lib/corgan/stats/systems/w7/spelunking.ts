// ===== SPELUNKING STUB (Stage 3 will port the real impl) =====
// We stub only the symbols that Stage 2 systems need to compile.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function legendPTSbonus(_idx: number, _saveData: SaveData): number {
  // Stage 3 TODO: read spelunkData[18] etc. For Stage 2 we return 0 so
  // legend-multi terms become 1.0 (no-op).
  return 0;
}

export const legendPTS = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Legend", id), 0, null, { fmt: "+", note: "stage3 stub" });
  },
};

export const spelunkShop = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Spelunking", id), 0, null, { fmt: "+", note: "stage3 stub" });
  },
};
