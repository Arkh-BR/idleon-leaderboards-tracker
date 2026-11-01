// ===== ARKH ARTIFACT FIND ENTRY POINT =====
// N.js Sailing("BoatArtiMulti", 0): the character only matters for Artifact 3
// (× Sailing level), Artifosho and the Sailing-skill-level terms. No map.

import artifactFindDesc from "./stats/defs/artifact-find";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhArtifactFind(rawEnvelope: any, charIdx: number): StatResult {
  return computeStatTree(artifactFindDesc, rawEnvelope, charIdx, 0);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhArtifactPools(rawEnvelope: any, charIdx: number): Record<string, Pool> {
  return computeStatPools(artifactFindDesc, rawEnvelope, charIdx, 0);
}

export function combineArtifactPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(artifactFindDesc, pools);
}
