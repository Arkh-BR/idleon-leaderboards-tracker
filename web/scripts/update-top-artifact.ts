// Refresh the bundled top-player Artifact Find reference in
// lib/artifactFind/topArtifactFind.ts (+ .meta.ts), on lib/game: the page's
// tracker (computeGameArtifactFind) read into pools, combined with the page's
// own gains model. Artifact Find is
// account-wide (Sailing BoatArtiMulti, boat 0): the character only matters for
// Artifact 3 (× Sailing level), Artifosho and the Sailing-skill-level terms, so
// the reference is ONE best-of-each-source set across all chars of all players
// (perFamily: false → family key "all"), with no class talents to gate.
//
// Run (from web/):  npx tsx scripts/update-top-artifact.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector, type StatCollectorConfig } from "./_shared/topStatCollector";
import { groupedCombine, groupParents, poolsOf } from "./_shared/gamePools";
import { computeGameArtifactFind } from "../lib/game/trackers/artifactFind";
import { ARTI_GROUPS, ARTI_ROOT } from "../lib/artifactFind/groups";
import { ARTIFACT_PAGE } from "../lib/artifactFind/pageConfig";

const PARENTS = groupParents(ARTI_ROOT, ARTI_GROUPS);

export const ARTIFACT_COLLECTOR: StatCollectorConfig = {
  label: "Artifact Find",
  focusBoard: "sailing",
  root: ARTI_ROOT,
  groups: ARTI_GROUPS,
  computePools: (save, ci) => poolsOf(computeGameArtifactFind(save, ci).tree, PARENTS),
  combine: groupedCombine(ARTI_ROOT, ARTI_GROUPS, ARTIFACT_PAGE.gains),
  gated: [],
  perFamily: false,
  outputFile: join(__dirname, "..", "lib", "artifactFind", "topArtifactFind.ts"),
  metaFile: join(__dirname, "..", "lib", "artifactFind", "topArtifactFind.meta.ts"),
  constPrefix: "TOP_ARTI",
  flatForClassFn: "topArtifactFlatForClass",
  scriptName: "scripts/update-top-artifact.ts",
};

// Imported by the round-trip test without running the collector.
if (require.main === module) runTopCollector(ARTIFACT_COLLECTOR).catch((e) => {
  console.error(e);
  process.exit(1);
});
