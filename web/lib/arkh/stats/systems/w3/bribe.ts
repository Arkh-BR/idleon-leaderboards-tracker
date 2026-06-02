// ===== BRIBE SYSTEM (W3) =====
import { treeResult, node, type TreeResult } from "../../../node";
import { bribeValue } from "../../data/common/bribes";
import type { SaveData } from "../../../state";

export function getBribeBonus(idx: number | string, saveData: SaveData): TreeResult {
  const i = typeof idx === "string" ? parseInt(idx, 10) : Math.round(idx);
  if (!saveData.bribeStatusData || (saveData.bribeStatusData[i] || 0) !== 1) {
    return treeResult(0);
  }
  const val = bribeValue(i);
  return treeResult(val, [
    node("Bribe " + i + " Active", 1, null, { fmt: "raw" }),
    node("Bribe Value", val, null, { fmt: "raw" }),
  ]);
}
