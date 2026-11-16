import type { Standings } from "@/lib/lbSnapshot";
import { LB_SNAPSHOT } from "./snapshot";
import { lowerIsBetter } from "./meta";
import { climbOne, gapToCutoff, printable } from "./metrics";
import type { LbMeta, LbPlayer, MetaMetric, RankEntry } from "./types";

/** One board the player is ranked on, with the tab and section it sits in. */
export type BoardRow = { tab: string; section: string; m: MetaMetric; e: RankEntry };
export type SectionKey = { tab: string; section: string };

export function boardRows(meta: LbMeta, ranks: Record<string, RankEntry>): BoardRow[] {
  return meta.tabs.flatMap((t) =>
    t.sections.flatMap((s) => s.metrics.filter((m) => ranks[m.key]).map((m) => ({ tab: t.key, section: s.name, m, e: ranks[m.key] }))),
  );
}

export const inSection = (rows: BoardRow[], f: SectionKey | null) =>
  f ? rows.filter((r) => r.tab === f.tab && r.section === f.section) : rows;

/** lbSnapshot's input: the player's current rank and value per board. */
export function standingsOf(player: LbPlayer): Standings {
  return Object.fromEntries(Object.entries(player.ranks).map(([k, e]) => [k, { rank: e.r, value: e.v }]));
}

export const worstPositions = (rows: BoardRow[], n = 40) => [...rows].sort((a, b) => b.e.p - a.e.p).slice(0, n);

export const bestPositions = (rows: BoardRow[], n = 30) => [...rows].sort((a, b) => a.e.r - b.e.r).slice(0, n);

export function cheapestClimbs(rows: BoardRow[], n = 15) {
  return rows
    .flatMap((row) => {
      const c = climbOne(row.e, lowerIsBetter(row.m.key));
      return c.kind === "gap" && printable(c.delta, row.m, row.e) ? [{ row, pct: c.pct, toRank: c.toRank }] : [];
    })
    .sort((a, b) => a.pct - b.pct)
    .slice(0, n);
}

/** Boards outside the cutoff with a known, printable gap to #10 / #100, cheapest first. */
export function cutoffGaps(rows: BoardRow[], cutoffRank: 10 | 100) {
  return rows
    .flatMap((row) => {
      const b = LB_SNAPSHOT.boards[row.m.key];
      const cutoff = cutoffRank === 10 ? b?.top10 : b?.top100;
      const g = gapToCutoff(row.e.v, row.e.r, cutoff, cutoffRank, lowerIsBetter(row.m.key));
      return g.kind === "gap" && printable(g.delta, row.m, row.e) ? [{ row, pct: g.pct, cutoff: cutoff! }] : [];
    })
    .sort((a, b) => a.pct - b.pct);
}

export const maxedMissing = (rows: BoardRow[]) => rows.filter((r) => r.m.maxed && r.e.r !== 1);

export const TIER_BANDS = [
  { label: "Top 10", max: 10 },
  { label: "11–50", max: 50 },
  { label: "51–100", max: 100 },
  { label: "101–500", max: 500 },
  { label: "500+", max: Infinity },
] as const;

export function tierCounts(rows: BoardRow[]) {
  const counts = TIER_BANDS.map((b) => ({ label: b.label, count: 0 }));
  for (const { e } of rows) counts[TIER_BANDS.findIndex((b) => e.r <= b.max)].count++;
  return counts;
}
