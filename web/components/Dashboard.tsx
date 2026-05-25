"use client";

import { useMemo } from "react";
import type { BoardResult } from "@/app/api/leaderboards/route";
import { formatIdleon, formatPct } from "@/lib/format";
import { rankBgClass, tierOf, TIER_LABELS, TIER_COLORS, type Tier } from "@/lib/rank";
import { netRankMovement, type BoardDelta } from "@/lib/lbSnapshot";

type Props = {
  boards: BoardResult[];
  player: string;
  // Optional snapshot inputs — when absent, the snapshot card is hidden.
  deltas?: Record<string, BoardDelta>;
  snapshotAt?: string | null;
};

const TIERS: Tier[] = [
  "top10",
  "top11_50",
  "top51_100",
  "top101_200",
  "rank200plus",
  "unranked",
];

const CATEGORIES_ORDER = [
  "Global",
  "General",
  "Tasks",
  "Skills",
  "Character",
  "Misc",
  "Caverns",
];

export default function Dashboard({
  boards,
  player,
  deltas,
  snapshotAt,
}: Props) {
  // Aggregate net rank movement across the whole account. Only used when
  // there's actually a snapshot to compare against.
  const movement = useMemo(() => {
    if (!deltas || !snapshotAt) return null;
    return netRankMovement(Object.values(deltas));
  }, [deltas, snapshotAt]);
  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = {
      top10: 0,
      top11_50: 0,
      top51_100: 0,
      top101_200: 0,
      rank200plus: 0,
      unranked: 0,
    };
    for (const b of boards) c[tierOf(b.myRank)]++;
    return c;
  }, [boards]);

  const heatmap = useMemo(() => {
    return CATEGORIES_ORDER.map((cat) => {
      const catBoards = boards.filter((b) => b.categoryLabel === cat);
      const counts: Record<Tier, number> = {
        top10: 0,
        top11_50: 0,
        top51_100: 0,
        top101_200: 0,
        rank200plus: 0,
        unranked: 0,
      };
      for (const b of catBoards) counts[tierOf(b.myRank)]++;
      return { cat, total: catBoards.length, counts };
    });
  }, [boards]);

  const worst = useMemo(
    () =>
      boards
        .filter((b) => b.myRank !== null)
        .sort((a, b) => (b.myRank ?? 0) - (a.myRank ?? 0))
        .slice(0, 40),
    [boards]
  );

  const quickWins = useMemo(
    () =>
      boards
        .filter(
          (b) =>
            b.myRank !== null &&
            b.myRank > 10 &&
            b.myRank <= 50 &&
            b.myScore !== null &&
            b.top10[9]?.score !== undefined
        )
        .sort((a, b) => (a.myRank ?? 0) - (b.myRank ?? 0)),
    [boards]
  );

  const best = useMemo(
    () =>
      boards
        .filter((b) => b.myRank !== null)
        .sort((a, b) => (a.myRank ?? 0) - (b.myRank ?? 0))
        .slice(0, 30),
    [boards]
  );

  return (
    <div className="space-y-8">
      {/* Snapshot movement — only when there's a baseline to compare against */}
      {movement && snapshotAt && (
        <Section
          title={`📸 Progress since ${new Date(snapshotAt).toLocaleDateString()}`}
        >
          <div className="space-y-3">
            <NetKpi
              label="Net rank movement"
              value={movement.total}
              hint={
                movement.total > 0
                  ? "Total ranks climbed across all boards"
                  : movement.total < 0
                    ? "Total ranks dropped across all boards"
                    : "No net change"
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SmallKpi
                label="Boards climbed"
                value={movement.gained}
                color="emerald"
              />
              <SmallKpi
                label="Boards dropped"
                value={movement.lost}
                color="red"
              />
            </div>
          </div>
        </Section>
      )}

      {/* Tier summary */}
      <Section title={movement && snapshotAt ? "1. Tier summary (current)" : "1. Tier summary"}>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {TIERS.map((t) => (
            <div key={t} className={`rounded p-3 text-center ${TIER_COLORS[t]}`}>
              <div className="text-xs font-medium opacity-80">
                {TIER_LABELS[t]}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {tierCounts[t]}
              </div>
              <div className="text-xs opacity-70 tabular-nums">
                {boards.length > 0
                  ? ((tierCounts[t] / boards.length) * 100).toFixed(1)
                  : "0.0"}
                %
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Heatmap */}
      <Section title="2. Heatmap by category">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-center px-3 py-2">Total</th>
                {TIERS.map((t) => (
                  <th key={t} className="text-center px-3 py-2 text-xs">
                    {TIER_LABELS[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map(({ cat, total, counts }) => (
                <tr key={cat} className="border-t border-zinc-800">
                  <td className="px-3 py-2 font-bold">{cat}</td>
                  <td className="px-3 py-2 text-center text-zinc-400">{total}</td>
                  {TIERS.map((t) => (
                    <td key={t} className="px-3 py-2 text-center">
                      <HeatCell tier={t} value={counts[t]} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-zinc-700 bg-ink/60 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-center">{boards.length}</td>
                {TIERS.map((t) => (
                  <td key={t} className="px-3 py-2 text-center tabular-nums">
                    {tierCounts[t]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Worst positions */}
      <Section title="3. Top 40 worst positions (focus on improving)">
        <RankedTable
          rows={worst.map((b) => {
            const top = b.top10[0]?.score;
            const gap1 = top != null && b.myScore != null ? top - b.myScore : null;
            const gap10 =
              b.top10[9] && b.myScore != null
                ? b.top10[9].score - b.myScore
                : null;
            return {
              key: b.apiKey,
              cells: [
                b.categoryLabel,
                b.label,
                <Rank rank={b.myRank} key="r" />,
                formatIdleon(b.myScore),
                formatIdleon(top ?? null),
                formatPct(b.myScore, top ?? null),
                gap1 !== null ? formatIdleon(gap1) : "—",
                gap10 !== null ? formatIdleon(gap10) : "—",
              ],
            };
          })}
          headers={[
            "Category",
            "Leaderboard",
            "Rank",
            "Score",
            "#1 Score",
            "% of #1",
            "Gap vs #1",
            "Gap vs #10",
          ]}
        />
      </Section>

      {/* Quick wins */}
      <Section title="4. Quick wins: closest to Top 10 (rank 11-50)">
        <RankedTable
          rows={quickWins.map((b) => {
            const score10 = b.top10[9]?.score ?? null;
            const gap =
              score10 !== null && b.myScore !== null
                ? score10 - b.myScore
                : null;
            return {
              key: b.apiKey,
              cells: [
                b.categoryLabel,
                b.label,
                <Rank rank={b.myRank} key="r" />,
                formatIdleon(b.myScore),
                formatIdleon(score10),
                gap !== null ? formatIdleon(gap) : "—",
                formatPct(b.myScore, score10),
              ],
            };
          })}
          headers={[
            "Category",
            "Leaderboard",
            "Rank",
            "Score",
            "#10 Score",
            "Gap to top 10",
            "% of #10",
          ]}
          emptyMsg="No leaderboards between rank 11 and 50."
        />
      </Section>

      {/* Best */}
      <Section title="5. Your best 30 positions">
        <RankedTable
          rows={best.map((b) => {
            const top = b.top10[0]?.score;
            return {
              key: b.apiKey,
              cells: [
                b.categoryLabel,
                b.label,
                <Rank rank={b.myRank} key="r" />,
                formatIdleon(b.myScore),
                formatIdleon(top ?? null),
                formatPct(b.myScore, top ?? null),
              ],
            };
          })}
          headers={[
            "Category",
            "Leaderboard",
            "Rank",
            "Score",
            "#1 Score",
            "% of #1",
          ]}
        />
      </Section>

      <div className="text-xs text-zinc-600 text-center">
        Analysis generated from{" "}
        <span className="font-mono text-zinc-500">{player}</span>&rsquo;s
        leaderboards.
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-3 bg-ink rounded px-3 py-2 border-l-4 border-gold">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Full-width hero card. Sign convention: positive = climbed (rank numbers
// went DOWN, which is good). Green for improvement, red for regression,
// zinc for no change. Layout is horizontal so the giant number sits next
// to its hint instead of stacking.
function NetKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  const sign = value > 0 ? "+" : "";
  const color =
    value > 0
      ? "text-emerald-400 border-emerald-700/50 bg-gradient-to-br from-emerald-950/30 to-zinc-900/40"
      : value < 0
        ? "text-red-400 border-red-800/50 bg-gradient-to-br from-red-950/30 to-zinc-900/40"
        : "text-zinc-300 border-zinc-700/60 bg-gradient-to-br from-zinc-900/60 to-zinc-900/30";
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-4">
          <div className="text-5xl font-bold tabular-nums leading-none">
            {sign}
            {value.toLocaleString()}
          </div>
          <div className="text-xs uppercase tracking-wider opacity-80 whitespace-nowrap">
            {label}
          </div>
        </div>
        {hint && (
          <div className="text-xs opacity-70 max-w-md text-right">{hint}</div>
        )}
      </div>
    </div>
  );
}

function SmallKpi({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number | string;
  color: "emerald" | "red" | "sky";
  hint?: string;
}) {
  const cls =
    color === "emerald"
      ? "text-emerald-400 border-emerald-800/40"
      : color === "red"
        ? "text-red-400 border-red-800/40"
        : "text-sky-400 border-sky-800/40";
  return (
    <div className={`rounded-lg border bg-zinc-900/40 p-3 ${cls}`}>
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {hint && <div className="text-xs text-zinc-500 mt-1.5">{hint}</div>}
    </div>
  );
}

function Rank({ rank }: { rank: number | null }) {
  return (
    <span
      className={`inline-block min-w-[2.5rem] px-2 py-0.5 rounded text-center text-xs ${rankBgClass(rank)}`}
    >
      {rank ?? "—"}
    </span>
  );
}

function HeatCell({ tier, value }: { tier: Tier; value: number }) {
  if (value === 0)
    return <span className="text-zinc-700">·</span>;
  const intensity =
    tier === "top10"
      ? value >= 8
        ? "bg-gold text-ink"
        : value >= 4
        ? "bg-yellow-400 text-ink"
        : "bg-yellow-200 text-ink"
      : tier === "top11_50"
      ? value >= 10
        ? "bg-green-500 text-white"
        : value >= 5
        ? "bg-green-400 text-ink"
        : "bg-green-300 text-ink"
      : tier === "top51_100"
      ? "bg-yellow-200 text-ink"
      : tier === "top101_200"
      ? value >= 8
        ? "bg-orange-500 text-white"
        : "bg-orange-300 text-ink"
      : tier === "rank200plus"
      ? value >= 8
        ? "bg-red-600 text-white font-bold"
        : "bg-red-400 text-white"
      : "bg-zinc-700 text-zinc-300";
  return (
    <span
      className={`inline-block min-w-[2rem] px-2 py-0.5 rounded text-xs font-bold tabular-nums ${intensity}`}
    >
      {value}
    </span>
  );
}

function RankedTable({
  headers,
  rows,
  emptyMsg = "No data to show.",
}: {
  headers: string[];
  rows: { key: string; cells: React.ReactNode[] }[];
  emptyMsg?: string;
}) {
  if (rows.length === 0) {
    return <div className="text-zinc-500 text-sm italic px-3 py-2">{emptyMsg}</div>;
  }
  return (
    <div className="overflow-x-auto rounded border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-zinc-300">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 ${i < 2 ? "text-left" : i === 2 ? "text-center" : "text-right"} text-xs`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-zinc-800">
              {row.cells.map((c, i) => (
                <td
                  key={i}
                  className={`px-3 py-2 ${
                    i < 2
                      ? "text-left"
                      : i === 2
                      ? "text-center"
                      : "text-right tabular-nums"
                  } ${i === 0 ? "text-zinc-400" : i === 1 ? "font-medium" : ""}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
