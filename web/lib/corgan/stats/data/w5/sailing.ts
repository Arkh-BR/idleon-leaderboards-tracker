// ===== W5 SAILING DATA =====
// Real port reading ArtifactInfo[idx][3] for each artifact's base bonus.
import { ArtifactInfo } from "../game/customlists.js";

export function artifactBase(idx: number): number {
  return Number((ArtifactInfo as any)[idx]?.[3]) || 0;
}
