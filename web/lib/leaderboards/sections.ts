import type { LbMeta, RankEntry } from "./types";

export type SectionStat = { tab: string; section: string; medianTopPct: number; boards: number };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function sectionStrength(ranks: Record<string, RankEntry>, meta: LbMeta): SectionStat[] {
  const out: SectionStat[] = [];
  for (const tab of meta.tabs)
    for (const sec of tab.sections) {
      const ps = sec.metrics.filter((m) => ranks[m.key]).map((m) => ranks[m.key].p);
      if (ps.length) out.push({ tab: tab.key, section: sec.name, medianTopPct: median(ps), boards: ps.length });
    }
  return out;
}
