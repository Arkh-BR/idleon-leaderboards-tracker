// ===== SHINY MEDALLIONS — owned-medallion list =====
// N.js ExpMulti(0) reads ActorEvents_713's _GenINFO[17], set once per map
// load from `Compass[3].includes(MapAFKtarget[CurrentMap])` (@12976791) — see
// SP/exp/semantics.md §1. Compass[3] is the array of raw monster names the
// account has picked up a medallion for (ActorEvents_44's "WWcoin" pickup
// branch, @8589714). A save-based compute reads Compass[3] directly instead
// of the live per-map flag. Task 5 (map picker) imports this too.
export function medallionList(s: any): string[] {
  const raw = (s?.compassData as any)?.[3];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }
  return [];
}
