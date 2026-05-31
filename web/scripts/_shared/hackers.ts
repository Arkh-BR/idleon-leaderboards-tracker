// Hacked / cheated saves poison the top-player "best per path" snapshots: the
// collectors keep the MAX of every node across all scanned players, so a single
// impossible stat dominates that node and inflates the whole tree (e.g. a save
// with 100,010 megafeathers turned the Owl's Megafeather Bonus into 50006x and
// blew up the entire hypothetical-max Drop Rate).
//
// We drop such saves before they enter ANY collector, in two layers:
//   1. A name denylist for known offenders.
//   2. A per-save sanity guard on "sentinel" stats that have a CONCEPTUAL cap
//      in-game. This is deliberately NOT a relative-magnitude check — legit
//      ceilings can be astronomically large (1e10+ is normal for some boards),
//      so we only gate stats whose maximum is bounded by game mechanics. A save
//      that trips any sentinel is discarded WHOLE, since a cheater rarely
//      inflates just one value.

import { parseSaveKey } from "../../lib/corgan/save/helpers";

/** Known hacked/cheated profiles (compared lowercased). */
const HACKER_DENYLIST = new Set<string>([
  // OLA[262] = 100,010 megafeathers → Megafeather Bonus 50006x → broke the
  // Owl / Additive Pool / Drop Rate hypothetical max.
  "xmrbatx",
]);

export function isDenylistedPlayer(name: string): boolean {
  return HACKER_DENYLIST.has(name.trim().toLowerCase());
}

// Megafeathers are earned one-at-a-time from Mega Resets, so even the most
// extreme legitimate account sits in the low hundreds at most. 1000 is an
// ultra-generous ceiling that never touches a real save but trivially catches
// the 100k+ hacks. (Conceptual cap, NOT a relative-magnitude threshold.)
const MEGAFEATHER_SANITY_CAP = 1000;

/**
 * Returns a human-readable reason if the raw "Copy for Support" envelope trips
 * a sanity sentinel (i.e. looks cheated), else null. Reads straight off the raw
 * save so it can run before the engine loads it. Extend with more sentinels as
 * new cheat vectors surface — keep each one a genuine conceptual cap.
 */
export function hackedSaveReason(rawEnvelope: any): string | null {
  const save = (rawEnvelope?.data ?? rawEnvelope) as Record<string, unknown>;
  if (!save || typeof save !== "object") return null;

  const ola = (parseSaveKey(save, "OptLacc") as any[]) || [];
  const megafeathers = Number(ola?.[262]) || 0;
  if (megafeathers > MEGAFEATHER_SANITY_CAP) {
    return `megafeathers=${megafeathers} > ${MEGAFEATHER_SANITY_CAP} (OLA[262])`;
  }

  return null;
}
