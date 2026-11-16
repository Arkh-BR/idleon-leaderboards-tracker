import { LB_SNAPSHOT } from "./snapshot";
import type { LbMeta } from "./types";

/** Live /meta when it has tabs, else the daily snapshot's copy. */
export function liveOrSnapshotMeta(live: LbMeta | null): LbMeta {
  return live && live.tabs?.length ? live : LB_SNAPSHOT.meta;
}

export function boardCount(): number {
  return LB_SNAPSHOT.meta.tabs.reduce((n, t) => n + t.sections.reduce((m, s) => m + s.metrics.length, 0), 0);
}

const DAY = 86_400_000;

/** "New" badge: the daily snapshot first saw the board within the last 14 days. */
export function isNewBoard(firstSeen: string | undefined, today: Date): boolean {
  return !!firstSeen && (today.getTime() - Date.parse(firstSeen)) / DAY < 15;
}

/** Direction comes from the daily snapshot; boards it hasn't seen yet count as higher-is-better. */
export const lowerIsBetter = (key: string): boolean => LB_SNAPSHOT.boards[key]?.lowerIsBetter ?? false;
