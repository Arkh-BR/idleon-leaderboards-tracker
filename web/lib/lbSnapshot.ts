// Per-player leaderboards snapshot stored in localStorage. Same pattern as
// the tome score snapshot — capture rank + score for every board at a point
// in time so the UI can show a Δ Rank / Δ Score per row and a net "ranks
// gained since save" KPI.
//
// Key shape: `idleon-leaderboards.lb.ptsSnapshot.<player-lower>`. Storing
// per-player (rather than one global blob) means the user can track several
// alts without snapshots leaking across player names.

const KEY_PREFIX = "idleon-leaderboards.lb.ptsSnapshot.";

/** Current standings per board key, built from `LbPlayer.ranks` (`{rank: e.r, value: e.v}`). */
export type Standings = Record<string, { rank: number; value: number }>;

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

export function saveSnapshot(player: string, boards: Standings): LbSnapshot {
  const snap: LbSnapshot = {
    savedAt: new Date().toISOString(),
    player,
    boards: {},
  };
  for (const [key, b] of Object.entries(boards)) {
    snap.boards[key] = { rank: b.rank, score: b.value };
  }
  try {
    localStorage.setItem(keyFor(player), JSON.stringify(snap));
  } catch {}
  return snap;
}

// Delta semantics per board (computeDelta returns one per key of `current`):
//   rankDelta > 0  → climbed (rank went DOWN numerically, e.g. 50 → 30 = +20)
//   rankDelta < 0  → dropped
//   rankDelta === 0 → unchanged
//
//   scoreDelta is just (currentScore - snapshotScore).
//
//   status:
//     "changed" → both ranks present, deltas valid
//     "nodata"  → no snapshot for this board (or its stored rank is null)
export type BoardDeltaStatus = "changed" | "nodata";

export type BoardDelta = {
  status: BoardDeltaStatus;
  rankDelta: number | null;
  scoreDelta: number | null;
};

export function computeDelta(current: Standings, snap: LbSnapshot | null): Record<string, BoardDelta> {
  const out: Record<string, BoardDelta> = {};
  for (const [key, cur] of Object.entries(current)) {
    const old = snap?.boards[key];
    out[key] =
      !old || old.rank === null
        ? { status: "nodata", rankDelta: null, scoreDelta: null }
        : { status: "changed", rankDelta: old.rank - cur.rank, scoreDelta: old.score === null ? null : cur.value - old.score };
  }
  return out;
}

// Aggregate "ranks gained / lost" across every board. Used by the Dashboard
// KPI card. Boards without changed status are skipped.
export function netRankMovement(deltas: BoardDelta[]): {
  total: number;
  gained: number;
  lost: number;
  unchanged: number;
} {
  let total = 0;
  let gained = 0;
  let lost = 0;
  let unchanged = 0;
  for (const d of deltas) {
    if (d.status === "changed" && d.rankDelta !== null) {
      total += d.rankDelta;
      if (d.rankDelta > 0) gained++;
      else if (d.rankDelta < 0) lost++;
      else unchanged++;
    }
  }
  return { total, gained, lost, unchanged };
}
