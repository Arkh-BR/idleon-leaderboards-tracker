// ===== GRIMOIRE STUB (Stage 4 will port real impl) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function grimoireUpgBonus22(_saveData: SaveData): number {
  return 0;
}

export function grimoireUpgBonus(_idx: number, _saveData: SaveData): number {
  return 0;
}

export const grimoire = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Grimoire", id), 0, null, { fmt: "+", note: "stage4 stub" });
  },
};
