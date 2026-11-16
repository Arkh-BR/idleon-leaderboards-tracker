import type { LbPlayer, RankEntry } from "./types";

export type H2HRow = { metric: string; a: RankEntry; b: RankEntry; winner: "a" | "b" | "tie" };

export function headToHead(a: LbPlayer, b: LbPlayer): { wins: number; losses: number; ties: number; rows: H2HRow[] } {
  const rows: H2HRow[] = [];
  for (const [metric, ea] of Object.entries(a.ranks)) {
    const eb = b.ranks[metric];
    if (eb) rows.push({ metric, a: ea, b: eb, winner: ea.r < eb.r ? "a" : ea.r > eb.r ? "b" : "tie" });
  }
  const n = (w: string) => rows.filter((r) => r.winner === w).length;
  return { wins: n("a"), losses: n("b"), ties: n("tie"), rows };
}
