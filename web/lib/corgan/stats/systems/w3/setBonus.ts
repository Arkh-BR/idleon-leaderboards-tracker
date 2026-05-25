// ===== SET BONUS STUB (Stage 3 will port) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function getSetBonus(_setKey: string): number {
  return 0;
}

export const setBonus = {
  resolve(id: string, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("Set", id), 0, null, { fmt: "+", note: "stage3 stub" });
  },
};
