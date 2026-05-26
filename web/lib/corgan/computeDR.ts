// ===== CORGAN DROP RATE ENTRY POINT =====
// Takes a raw "Copy for Support" envelope, loads it into the Corgan state
// singleton, then runs buildTree(dropRateDesc) to produce the Corgan-style
// breakdown tree (LUK Scaling → ×1.4 → Main Additive Pool → LUK2 Additive
// Pool → Sum/100+1 → Chip Cap-Break → Post-Processing).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import * as data from "./save/data";
import { buildTree } from "./stats/tree-builder";
import { getCatalog } from "./stats/registry";
import dropRateDesc from "./stats/defs/drop-rate";
import type { CorganNode } from "./node";

export type CorganDRResult = {
  tree: CorganNode;
  total: number;
};

export type ComputeDROpts = {
  /** Toggle the invisible +0.10 Gallery Bonus Multi from Lab chip being
   *  active at the moment the gallery refreshed. Cannot be detected from
   *  save state; users opt in via UI. */
  chipGalleryActive?: boolean;
};

export function computeCorganDropRate(
  rawEnvelope: any,
  charIdx: number,
  mapIdx: number = 0,
  opts?: ComputeDROpts
): CorganDRResult {
  loadSaveData(rawEnvelope);
  // mapBonData is a module-level export in save/data.ts (matches Corgan's
  // structure). Re-read after loadSaveData populates it.
  const mapBon = data.mapBonData;
  const ctx = {
    saveData,
    charIdx,
    activeCharIdx: charIdx,
    mapBon,
    mapIdx,
    chipGalleryActive: !!opts?.chipGalleryActive,
  };
  const tree = buildTree(dropRateDesc, getCatalog(), ctx);
  return { tree, total: tree.val };
}
