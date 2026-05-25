// ===== CORGAN DROP RATE ENTRY POINT =====
// Takes a raw "Copy for Support" envelope, loads it into the Corgan state
// singleton, then runs buildTree(dropRateDesc) to produce the Corgan-style
// breakdown tree (LUK Scaling → ×1.4 → Main Additive Pool → LUK2 Additive
// Pool → Sum/100+1 → Chip Cap-Break → Post-Processing).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import { buildTree } from "./stats/tree-builder";
import { getCatalog } from "./stats/registry";
import dropRateDesc from "./stats/defs/drop-rate";
import type { CorganNode } from "./node";

export type CorganDRResult = {
  tree: CorganNode;
  total: number;
};

export function computeCorganDropRate(
  rawEnvelope: any,
  charIdx: number,
  mapIdx: number = 0
): CorganDRResult {
  loadSaveData(rawEnvelope);
  const mapBon = (saveData as any).mapBonData || [];
  const ctx = { saveData, charIdx, activeCharIdx: charIdx, mapBon, mapIdx };
  const tree = buildTree(dropRateDesc, getCatalog(), ctx);
  return { tree, total: tree.val };
}
