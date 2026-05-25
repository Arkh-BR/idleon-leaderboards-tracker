// ===== PRISTINE STUB (Stage 3 will port) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function pristineBon(_idx: number, _saveData: SaveData): number {
  return 0;
}

export const pristine = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Pristine", id), 0, null, { fmt: "+", note: "stage3 stub" });
  },
};
