import { notateBig, notateMultiplierInfo } from "@/lib/coinMulti/format";

// The game's own display of Sailing("BoatArtiMulti", 0) in the Skill Info:
// NotateNumber "Big" above 1e4, "MultiplierInfo" otherwise. Returns the text
// without the trailing "x".
export function formatArtifactFind(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return x > 1e4 ? notateBig(x) : notateMultiplierInfo(x);
}
