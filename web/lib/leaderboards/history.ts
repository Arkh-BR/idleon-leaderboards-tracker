import type { LbPlayer } from "./types";

export type Baseline = { createdAt: number; ranks: Record<string, number>; globalRank: number };
export type HistoryPoint = { createdAt: number; globalRank: number; top10: number; top100: number };

const key = (kind: string, player: string) => `idleon-leaderboards.v4.${kind}.${player.toLowerCase()}`;

function read<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable: skip */
  }
}

export function sinceLastVisit(player: string, current: LbPlayer): { baseline: Baseline | null; moves: Record<string, number>; globalMove: number } {
  const k = key("baseline", player);
  const baseline = read<Baseline>(k);
  if (!baseline || current.createdAt > baseline.createdAt)
    write(k, { createdAt: current.createdAt, ranks: Object.fromEntries(Object.entries(current.ranks).map(([m, e]) => [m, e.r])), globalRank: current.player.rank } satisfies Baseline);
  if (!baseline) return { baseline: null, moves: {}, globalMove: 0 };
  const moves: Record<string, number> = {};
  for (const [m, e] of Object.entries(current.ranks)) if (m in baseline.ranks) moves[m] = baseline.ranks[m] - e.r;
  return { baseline, moves, globalMove: baseline.globalRank - current.player.rank };
}

export function loadHistory(player: string): HistoryPoint[] {
  const h = read<HistoryPoint[]>(key("history", player));
  return Array.isArray(h) ? h : [];
}

export function appendHistory(player: string, current: LbPlayer): HistoryPoint[] {
  const h = loadHistory(player);
  if (h.length && current.createdAt <= h[h.length - 1].createdAt) return h;
  const rs = Object.values(current.ranks);
  const next = [...h, { createdAt: current.createdAt, globalRank: current.player.rank, top10: rs.filter((e) => e.r <= 10).length, top100: rs.filter((e) => e.r <= 100).length }].slice(-365);
  write(key("history", player), next);
  return next;
}
