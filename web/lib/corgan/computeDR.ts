// ===== CORGAN DROP RATE ENTRY POINT =====
// Takes a raw "Copy for Support" envelope, loads it into the Corgan state
// singleton, then runs buildTree(dropRateDesc) to produce the Corgan-style
// breakdown tree (LUK Scaling → ×1.4 → Main Additive Pool → LUK2 Additive
// Pool → Sum/100+1 → Chip Cap-Break → Post-Processing).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import * as data from "./save/data";
import { buildTree, buildPools, type Pool } from "./stats/tree-builder";
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
  /** Research mode for the Base Level node inside every talent's Effective
   *  Level subtree. When true, both "Points Invested" and the parent "Base
   *  Level" default to Max Book Lv Cap (we're researching the THEORY max,
   *  so the user starts at the ceiling and only ever edits downward). When
   *  false (default), Points Invested = actual rawLv from the save and
   *  Base Level = min(rawLv, cap) — this is what /drop-rate and
   *  /talents-level want, so Base + Bonus = Effective Level holds. Used by
   *  the gen-source-catalog tool and the standalone dr-max-values.html
   *  research tool. */
  useMaxResearchBaseLevel?: boolean;
  /** Surface the Spelunk Super Talent bonus as a sibling of Bonus Levels
   *  (a "Super Levels" node) instead of leaving it bundled inside the
   *  Bonus Levels chain. When true (used by /talents-level), the emitted
   *  Effective Level structure is Base + Bonus + Super; when false
   *  (default, used by /drop-rate and the research tool), Bonus already
   *  includes Super and there's no separate Super node — the tree shape
   *  the gen-source catalog expects stays unchanged. */
  splitSuperLevels?: boolean;
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
    useMaxResearchBaseLevel: !!opts?.useMaxResearchBaseLevel,
    splitSuperLevels: !!opts?.splitSuperLevels,
  };
  const tree = buildTree(dropRateDesc, getCatalog(), ctx);
  return { tree, total: tree.val };
}

/**
 * Resolve the DR pools for a save WITHOUT running combine(). Used by the
 * top-player collector to aggregate the best value per source across many
 * saves before recomputing the headline formula.
 */
export function computeCorganDRPools(
  rawEnvelope: any,
  charIdx: number,
  mapIdx: number = 0,
  opts?: ComputeDROpts
): Record<string, Pool> {
  loadSaveData(rawEnvelope);
  const mapBon = data.mapBonData;
  const ctx = {
    saveData,
    charIdx,
    activeCharIdx: charIdx,
    mapBon,
    mapIdx,
    chipGalleryActive: !!opts?.chipGalleryActive,
    useMaxResearchBaseLevel: !!opts?.useMaxResearchBaseLevel,
    splitSuperLevels: !!opts?.splitSuperLevels,
  };
  return buildPools(dropRateDesc, getCatalog(), ctx);
}

/**
 * Run the DR formula (dropRateDesc.combine) on a — possibly synthetic —
 * pool set to produce the final tree + total. combine() ignores ctx for
 * drop-rate, so a minimal ctx is fine. Lets the collector feed a "best of
 * each source" pool set and get back the recomputed hypothetical-max DR.
 */
export function combineDRPools(pools: Record<string, Pool>): CorganDRResult {
  const result = dropRateDesc.combine(pools, {} as never);
  return {
    tree: {
      name: "Drop Rate",
      val: result.val,
      fmt: "x",
      children: result.children,
    },
    total: result.val,
  };
}
