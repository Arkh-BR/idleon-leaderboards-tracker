"use client";

import type { LbPlayer, MetaMetric, MetaTab, RankEntry } from "@/lib/leaderboards/types";
import { LB_SNAPSHOT } from "@/lib/leaderboards/snapshot";
import { climbOne, gapToCutoff } from "@/lib/leaderboards/metrics";
import { formatGap, formatMetric } from "@/lib/leaderboards/format";
import { isNewBoard } from "@/lib/leaderboards/meta";

export type BoardSort = "it" | "closest" | "worst";

type Props = {
  tab: MetaTab;
  player: LbPlayer | null;
  moves: Record<string, number>;
  sort: BoardSort;
  onExpand(metric: MetaMetric): void;
};

const lowerIsBetter = (key: string) => LB_SNAPSHOT.boards[key]?.lowerIsBetter ?? false;
const sectionId = (tab: string, name: string) => `section-${tab}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function climbText(m: MetaMetric, e: RankEntry): string {
  const c = climbOne(e, lowerIsBetter(m.key));
  if (c.kind === "top") return "#1";
  if (c.kind === "tied-top") return `tied #1 (${c.ties})`;
  if (c.kind === "gap") return `${formatGap(e.v, e.nv!, m.notation)} passes #${c.toRank}`;
  return "—";
}

function Top100({ m, e }: { m: MetaMetric; e: RankEntry }) {
  const cutoff = LB_SNAPSHOT.boards[m.key]?.top100;
  const g = gapToCutoff(e.v, e.r, cutoff, 100, lowerIsBetter(m.key));
  if (g.kind === "inside") return <span className="text-emerald-400">in top 100</span>;
  if (g.kind === "unknown") return <span title="available after the next daily refresh">—</span>;
  return <>{formatGap(e.v, cutoff!, m.notation)}</>;
}

// Sort key as [group, value]; lower sorts first. Boards without a player entry go last.
function sortKey(sort: BoardSort, m: MetaMetric, e: RankEntry | undefined): [number, number] {
  if (!e) return [3, 0];
  if (sort === "worst") return [0, -e.p];
  const c = climbOne(e, lowerIsBetter(m.key));
  return c.kind === "gap" ? [0, c.pct] : c.kind === "unknown" ? [1, 0] : [2, 0];
}

function sorted(metrics: MetaMetric[], ranks: Record<string, RankEntry>, sort: BoardSort): MetaMetric[] {
  if (sort === "it") return metrics;
  const k = new Map(metrics.map((m) => [m.key, sortKey(sort, m, ranks[m.key])]));
  return [...metrics].sort((a, b) => {
    const [ga, va] = k.get(a.key)!;
    const [gb, vb] = k.get(b.key)!;
    return ga - gb || va - vb;
  });
}

function Move({ n }: { n: number | undefined }) {
  if (!n) return null;
  return <span className={`ml-1.5 text-xs ${n > 0 ? "text-emerald-400" : "text-red-400"}`}>{n > 0 ? `▲${n}` : `▼${-n}`}</span>;
}

const Badge = ({ children, cls }: { children: string; cls: string }) => (
  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>
);

export default function BoardTable({ tab, player, moves, sort, onExpand }: Props) {
  const ranks = player?.ranks ?? {};
  const today = new Date();
  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {tab.sections.map((s) => (
          <a key={s.name} href={`#${sectionId(tab.key, s.name)}`} className="text-zinc-400 hover:text-emerald-300">
            {s.name}
          </a>
        ))}
      </nav>
      {tab.sections.map((s) => (
        <section key={s.name} id={sectionId(tab.key, s.name)} className="mb-6 scroll-mt-16">
          <h3 className="mb-2 text-sm font-semibold text-zinc-200">{s.name}</h3>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-xs text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Board</th>
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium text-right">Value</th>
                  <th className="px-3 py-2 font-medium text-right">Top %</th>
                  <th className="px-3 py-2 font-medium">To climb</th>
                  <th className="px-3 py-2 font-medium">To top 100</th>
                </tr>
              </thead>
              <tbody>
                {sorted(s.metrics, ranks, sort).map((m) => {
                  const e = ranks[m.key];
                  return (
                    <tr key={m.key} id={`board-${m.key}`} className="scroll-mt-16 border-t border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60">
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onExpand(m)} className="text-left text-zinc-100 hover:text-emerald-300">
                          {m.label}
                        </button>
                        {m.maxed && <Badge cls="bg-amber-900/40 text-amber-300">Maxed</Badge>}
                        {isNewBoard(LB_SNAPSHOT.boards[m.key]?.firstSeen, today) && <Badge cls="bg-emerald-900/40 text-emerald-300">New</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        {e && (
                          <>
                            <span title={`#${e.r} / ${m.players.toLocaleString("en-US")} players`}>#{e.r}</span>
                            <Move n={moves[m.key]} />
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{e && formatMetric(e.v, m.notation)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-400">{e && `${e.p.toFixed(2)}%`}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-300">{e && climbText(m, e)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-300">{e && <Top100 m={m} e={e} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
