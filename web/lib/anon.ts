// Anonymous-player helpers, shared between the client views (the Leaderboards
// "hide anonymous" toggle) and the build-time collectors. Kept as a plain
// module (no "use client") so the tsx scripts can import it too.

import type { BoardResult } from "@/app/api/leaderboards/route";

/** IdleonToolbox masks opted-out players as "Anon#xxxxxx" (and occasionally
 *  "Anon " / blank). Their profiles aren't publicly viewable. */
export function isAnonymous(name: string): boolean {
  return name.startsWith("Anon#") || name.startsWith("Anon ") || !name.trim();
}

type TopEntry = BoardResult["top10"][number];

export type EffectiveTop = {
  /** The top list to display — filtered when hideAnon is on. */
  list: TopEntry[];
  /** First real entry (the effective "#1"); undefined if the list is empty. */
  top1: TopEntry | undefined;
  /** Tenth real entry (the effective "#10"); usually undefined once filtered —
   *  we can't backfill an 11th player, the API only returns the top 10. */
  top10th: TopEntry | undefined;
  removedCount: number;
  truncated: boolean;
};

/**
 * Centralizes the top10[0]/top10[9] reads so the Leaderboards table and
 * dashboard derive their "#1"/"#10"-based metrics from a single filtered view.
 * With hideAnon off it's a pass-through (zero behavior change).
 */
export function effectiveTop(
  top10: BoardResult["top10"],
  hideAnon: boolean
): EffectiveTop {
  if (!hideAnon) {
    return {
      list: top10,
      top1: top10[0],
      top10th: top10[9],
      removedCount: 0,
      truncated: false,
    };
  }
  const list = top10.filter((e) => !isAnonymous(e.name));
  return {
    list,
    top1: list[0],
    top10th: list[9],
    removedCount: top10.length - list.length,
    truncated: list.length < top10.length,
  };
}
