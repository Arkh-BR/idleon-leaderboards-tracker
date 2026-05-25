// ===== SUSHI STUB (Stage 4 will port) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

export function rogBonusQTY(_idx: number, _uniqueSushi: number): number {
  return 0;
}

export const sushiRoG = {
  resolve(id: number, _ctx: { saveData: SaveData }): CorganNode {
    return node(label("RoG", id), 0, null, { fmt: "+", note: "stage4 stub" });
  },
};
