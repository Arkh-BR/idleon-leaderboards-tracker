// Refresh the bundled top-player Artifact Find reference in
// lib/artifactFind/topArtifactFind.ts (+ .meta.ts). Artifact Find is
// account-wide (Sailing BoatArtiMulti, boat 0): the character only matters for
// Artifact 3 (× Sailing level), Artifosho and the Sailing-skill-level terms, so
// the reference is ONE best-of-each-source set across all chars of all players
// (perFamily: false → family key "all"), with no class talents to gate.
//
// Run (from web/):  npx tsx scripts/update-top-artifact.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { computeArkhArtifactPools, combineArtifactPools } from "../lib/arkh/computeArtifactFind";
import { ARTI_ROOT, ARTI_GROUPS } from "../lib/arkh/stats/defs/artifact-find";

runTopCollector({
  label: "Artifact Find",
  focusBoard: "sailing",
  root: ARTI_ROOT,
  groups: ARTI_GROUPS,
  computePools: computeArkhArtifactPools,
  combine: combineArtifactPools,
  gated: [],
  perFamily: false,
  outputFile: join(__dirname, "..", "lib", "artifactFind", "topArtifactFind.ts"),
  metaFile: join(__dirname, "..", "lib", "artifactFind", "topArtifactFind.meta.ts"),
  constPrefix: "TOP_ARTI",
  flatForClassFn: "topArtifactFlatForClass",
  scriptName: "scripts/update-top-artifact.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
