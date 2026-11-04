// ===== ARTIFACT FIND DESCRIPTOR =====
// N.js Sailing("BoatArtiMulti", b) (live sha 4a6cb9a0c645), the value Skill Info
// shows for Sailing, with b = 0 (the boat the game displays): one additive
// group (A1–A11) and 23 multiplicative factors (M1–M23), in game order. Every
// term is a source of the `artifact` system (systems/artifact/artifact.ts); a
// group's shape lives here:
//   pct → 1 + Σ/100      raw → 1 + Σ      mult → Π (max1: Math.max(1, Π))
//
// ponytail: no outer max(1, …) — N.js has one, but every group factor is ≥ 1
// (non-negative sums, max1 products, Nightmariner/Davey Jones ≥ 1), so it can
// never bite.

import type { Descriptor } from "../tree-builder";
import { ARTI_GROUPS, ARTI_ROOT } from "@/lib/artifactFind/groups";
import { groupedDescriptor } from "./grouped";

export { ARTI_GROUPS, ARTI_ROOT, ARTI_VOTE_NAME } from "@/lib/artifactFind/groups";

const artifactFindDesc: Descriptor = groupedDescriptor({
  id: "artifact-find",
  name: ARTI_ROOT,
  scope: "character",
  category: "sailing",
  system: "artifact",
  groups: ARTI_GROUPS,
});

export default artifactFindDesc;
