// Per-player leaderboards snapshot stored in localStorage. Same pattern as
// the tome score snapshot — capture rank + score for every board at a point
// in time so the UI can show a Δ Rank / Δ Score per row and a net "ranks
// gained since save" KPI.
//
// Key shape: `idleon-leaderboards.lb.ptsSnapshot.<player-lower>`. Storing
// per-player (rather than one global blob) means the user can track several
// alts without snapshots leaking across player names.

import type { BoardResult } from "@/app/api/leaderboards/route";

const KEY_PREFIX = "idleon-leaderboards.lb.ptsSnapshot.";

export type LbSnapshot = {
  savedAt: string; // ISO timestamp
  player: string;
  boards: Record<string, { rank: number | null; score: number | null }>;
};

function keyFor(player: string): string {
  return KEY_PREFIX + player.trim().toLowerCase();
}

export function loadSnapshot(player: string): LbSnapshot | null {
  if (!player) return null;
  try {
    const raw = localStorage.getItem(keyFor(player));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LbSnapshot;
    if (!parsed || typeof parsed !== "object" || !parsed.boards) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSnapshot(player: string, boards: BoardResult[]): LbSnapshot {
  const snap: LbSnapshot = {
    savedAt: new Date().toISOString(),
    player,
    boards: {},
  };
  for (const b of boards) {
    snap.boards[b.apiKey] = { rank: b.myRank, score: b.myScore };
  }
  try {
    localStorage.setItem(keyFor(player), JSON.stringify(snap));
  } catch {}
  return snap;
}

// Delta semantics for a single board:
//   rankDelta > 0  → climbed (rank went DOWN numerically, e.g. 50 → 30 = +20)
//   rankDelta < 0  → dropped
//   rankDelta === 0 → unchanged
//   null           → status not "changed" (new / off / nodata)
//
//   scoreDelta is just (currentScore - snapshotScore).
//
//   status:
//     "changed" → both present, deltas valid
//     "new"     → wasn't on board at snapshot, is now
//     "off"     → was on board at snapshot, not now
//     "same"    → both null (was and is unranked) — show "—"
//     "nodata"  → no snapshot for this board at all
export type BoardDeltaStatus = "changed" | "new" | "off" | "same" | "nodata";

export type BoardDelta = {
  status: BoardDeltaStatus;
  rankDelta: number | null;
  scoreDelta: number | null;
};

export function computeDelta(
  current: { myRank: number | null; myScore: number | null },
  snap: { rank: number | null; score: number | null } | undefined
): BoardDelta {
  if (!snap) return { status: "nodata", rankDelta: null, scoreDelta: null };

  const wasRanked = snap.rank !== null;
  const isRanked = current.myRank !== null;

  if (!wasRanked && !isRanked) {
    return { status: "same", rankDelta: null, scoreDelta: null };
  }
  if (!wasRanked && isRanked) {
    return { status: "new", rankDelta: null, scoreDelta: null };
  }
  if (wasRanked && !isRanked) {
    return { status: "off", rankDelta: null, scoreDelta: null };
  }
  // Both ranked → compute deltas. Sign convention: positive = improvement.
  const rankDelta = (snap.rank as number) - (current.myRank as number);
  const scoreDelta =
    current.myScore !== null && snap.score !== null
      ? current.myScore - snap.score
      : null;
  return { status: "changed", rankDelta, scoreDelta };
}

// Aggregate "ranks gained / lost" across every board. Used by the Dashboard
// KPI card. Boards without changed status are skipped.
export function netRankMovement(deltas: BoardDelta[]): {
  total: number;
  gained: number;
  lost: number;
  unchanged: number;
  joined: number;
  fellOff: number;
} {
  let total = 0;
  let gained = 0;
  let lost = 0;
  let unchanged = 0;
  let joined = 0;
  let fellOff = 0;
  for (const d of deltas) {
    if (d.status === "new") joined++;
    else if (d.status === "off") fellOff++;
    else if (d.status === "changed" && d.rankDelta !== null) {
      total += d.rankDelta;
      if (d.rankDelta > 0) gained++;
      else if (d.rankDelta < 0) lost++;
      else unchanged++;
    }
  }
  return { total, gained, lost, unchanged, joined, fellOff };
}
