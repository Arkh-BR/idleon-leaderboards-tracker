import { LB_SNAPSHOT } from "./snapshot";
import type { LbMeta } from "./types";

/** Live /meta when it has tabs, else the daily snapshot's copy. */
export function liveOrSnapshotMeta(live: LbMeta | null): LbMeta {
  return live && live.tabs?.length ? live : LB_SNAPSHOT.meta;
}

export function boardCount(): number {
  return LB_SNAPSHOT.meta.tabs.reduce((n, t) => n + t.sections.reduce((m, s) => m + s.metrics.length, 0), 0);
}
