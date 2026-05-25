// ===== TESSERACT / ARCANE STUB (Stage 4 will port real impl) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function arcaneUpgBonus(_idx: number, _saveData: SaveData): number {
  return 0;
}

export const arcaneMap = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Arcane", id), 0, null, { fmt: "x", note: "stage4 stub" });
  },
};
