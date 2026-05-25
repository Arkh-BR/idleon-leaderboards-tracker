"use client";

import { useMemo, useState } from "react";
import type { BoardResult } from "@/app/api/leaderboards/route";
import { formatIdleon, formatPct } from "@/lib/format";
import { rankBgClass } from "@/lib/rank";
import type { BoardDelta } from "@/lib/lbSnapshot";

type SortKey =
  | "default" // IT order — categories in tab order, boards in IT's curated order
  | "category"
  | "label"
  | "rank"
  | "score"
  | "pct"
  | "rankDelta"
  | "scoreDelta";
type SortDir = "asc" | "desc";

type Props = {
  boards: BoardResult[];
  // Per-board delta vs the saved snapshot (empty object if no snapshot).
  deltas?: Record<string, BoardDelta>;
};

const CATEGORY_OPTIONS = [
  "All",
  "Global",
  "General",
  "Tasks",
  "Skills",
  "Character",
  "Misc",
  "Caverns",
];

export default function LeaderboardsTable({ boards, deltas = {} }: Props) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  // Default is "Smart sort": preserve the order the API returned the boards
  // in, which already matches IT's tab + within-tab curated order (our
  // registry was authored against the same source).
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Snapshot of each board's index in the original response. Used as the
  // tie-breaker for Smart sort and as the value when sortKey === "default".
  const originalOrder = useMemo(() => {
    const m = new Map<string, number>();
    boards.forEach((b, i) => m.set(b.apiKey, i));
    return m;
  }, [boards]);

  const hasAnySnapshot = useMemo(
    () => Object.values(deltas).some((d) => d.status !== "nodata"),
    [deltas]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boards.filter((b) => {
      if (category !== "All" && b.categoryLabel !== category) return false;
      if (q && !b.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [boards, category, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];

    // Smart sort always returns boards in original (IT) order, ignoring the
    // sortDir toggle — there's no "reverse IT order" use case.
    if (sortKey === "default") {
      arr.sort(
        (a, b) =>
          (originalOrder.get(a.apiKey) ?? 0) -
          (originalOrder.get(b.apiKey) ?? 0)
      );
      return arr;
    }

    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case "category":
          av = a.categoryLabel;
          bv = b.categoryLabel;
          break;
        case "label":
          av = a.label;
          bv = b.label;
          break;
        case "rank":
          av = a.myRank ?? Number.MAX_SAFE_INTEGER;
          bv = b.myRank ?? Number.MAX_SAFE_INTEGER;
          break;
        case "score":
          av = a.myScore ?? -Infinity;
          bv = b.myScore ?? -Infinity;
          break;
        case "pct": {
          const aTop = a.top10[0]?.score;
          const bTop = b.top10[0]?.score;
          av = aTop && a.myScore != null ? a.myScore / aTop : -Infinity;
          bv = bTop && b.myScore != null ? b.myScore / bTop : -Infinity;
          break;
        }
        case "rankDelta": {
          // Bigger climb (positive delta) sorts first when desc. Boards
          // without a snapshot sink to the bottom regardless of direction.
          const da = deltas[a.apiKey]?.rankDelta ?? Number.NEGATIVE_INFINITY;
          const db = deltas[b.apiKey]?.rankDelta ?? Number.NEGATIVE_INFINITY;
          av = da;
          bv = db;
          break;
        }
        case "scoreDelta": {
          const da = deltas[a.apiKey]?.scoreDelta ?? Number.NEGATIVE_INFINITY;
          const db = deltas[b.apiKey]?.scoreDelta ?? Number.NEGATIVE_INFINITY;
          av = da;
          bv = db;
          break;
        }
        // "default" is handled in the early-return above; TS narrows it
        // out of the union so we don't need a case for it here.
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, deltas, originalOrder]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir(k === "rank" ? "asc" : "desc");
    }
  }

  function toggleExpand(apiKey: string) {
    const next = new Set(expanded);
    if (next.has(apiKey)) next.delete(apiKey);
    else next.add(apiKey);
    setExpanded(next);
  }

  function sortIndicator(k: SortKey) {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search leaderboard…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <button
          onClick={() => {
            setSortKey("default");
            setSortDir("asc");
          }}
          disabled={sortKey === "default"}
          className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
            sortKey === "default"
              ? "border-gold/50 text-gold bg-gold/10 cursor-default"
              : "border-zinc-700 text-zinc-300 hover:border-gold hover:text-gold"
          }`}
          title="Restore IT's curated order — tabs (Global → General → Tasks → Skills → Character → Misc → Caverns), boards in their canonical sequence within each."
        >
          🎯 Smart sort
        </button>
        <span className="text-xs text-zinc-500">
          {sorted.length} / {boards.length} leaderboards
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th
                className="text-left px-3 py-2 cursor-pointer hover:bg-zinc-800"
                onClick={() => toggleSort("category")}
              >
                Category{sortIndicator("category")}
              </th>
              <th
                className="text-left px-3 py-2 cursor-pointer hover:bg-zinc-800"
                onClick={() => toggleSort("label")}
              >
                Leaderboard{sortIndicator("label")}
              </th>
              <th
                className="text-center px-3 py-2 cursor-pointer hover:bg-zinc-800 w-24"
                onClick={() => toggleSort("rank")}
              >
                Rank{sortIndicator("rank")}
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:bg-zinc-800"
                onClick={() => toggleSort("score")}
              >
                Score{sortIndicator("score")}
              </th>
              {hasAnySnapshot && (
                <>
                  <th
                    className="text-center px-3 py-2 cursor-pointer hover:bg-zinc-800 w-24"
                    onClick={() => toggleSort("rankDelta")}
                    title="Rank movement since snapshot. Green = climbed (lower rank number), red = dropped."
                  >
                    Δ Rank{sortIndicator("rankDelta")}
                  </th>
                  <th
                    className="text-right px-3 py-2 cursor-pointer hover:bg-zinc-800 w-28 hidden sm:table-cell"
                    onClick={() => toggleSort("scoreDelta")}
                    title="Score change since snapshot"
                  >
                    Δ Score{sortIndicator("scoreDelta")}
                  </th>
                </>
              )}
              <th className="text-right px-3 py-2 hidden md:table-cell">
                Diff vs #1
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:bg-zinc-800 hidden md:table-cell w-24"
                onClick={() => toggleSort("pct")}
              >
                % of #1{sortIndicator("pct")}
              </th>
              <th className="text-left px-3 py-2 hidden lg:table-cell">
                Top 1
              </th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const top1 = b.top10[0];
              const diff =
                top1 && b.myScore != null ? top1.score - b.myScore : null;
              const isOpen = expanded.has(b.apiKey);
              return (
                <FragmentRow
                  key={b.apiKey}
                  board={b}
                  top1={top1}
                  diff={diff}
                  isOpen={isOpen}
                  onToggle={() => toggleExpand(b.apiKey)}
                  delta={deltas[b.apiKey]}
                  showDeltaCols={hasAnySnapshot}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  board: b,
  top1,
  diff,
  isOpen,
  onToggle,
  delta,
  showDeltaCols,
}: {
  board: BoardResult;
  top1: { name: string; score: number } | undefined;
  diff: number | null;
  isOpen: boolean;
  onToggle: () => void;
  delta: BoardDelta | undefined;
  showDeltaCols: boolean;
}) {
  // 8 base columns; +2 when snapshot is active
  const colSpan = 8 + (showDeltaCols ? 2 : 0);
  return (
    <>
      <tr className="border-t border-zinc-800 hover:bg-zinc-900/40">
        <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
          {b.categoryLabel}
        </td>
        <td className="px-3 py-2 font-medium">{b.label}</td>
        <td className="px-3 py-2 text-center">
          <span
            className={`inline-block min-w-[2.5rem] px-2 py-0.5 rounded text-center text-xs ${rankBgClass(b.myRank)}`}
          >
            {b.myRank ?? "—"}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {formatIdleon(b.myScore)}
        </td>
        {showDeltaCols && (
          <>
            <td className="px-3 py-2 text-center text-xs">
              <RankDeltaBadge delta={delta} />
            </td>
            <td className="px-3 py-2 text-right text-xs tabular-nums hidden sm:table-cell">
              <ScoreDeltaText delta={delta} />
            </td>
          </>
        )}
        <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell text-zinc-400">
          {diff !== null ? formatIdleon(diff) : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
          {formatPct(b.myScore, top1?.score ?? null)}
        </td>
        <td className="px-3 py-2 hidden lg:table-cell text-zinc-300 truncate max-w-[160px]">
          {top1 ? (
            <span>
              <span className="text-gold">★</span> {top1.name}{" "}
              <span className="text-zinc-500">({formatIdleon(top1.score)})</span>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-2 py-2 text-right">
          <button
            onClick={onToggle}
            className="text-zinc-500 hover:text-zinc-200 text-xs"
            aria-label={isOpen ? "Collapse" : "Expand top 10"}
          >
            {isOpen ? "▲" : "▼"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-zinc-950/60 border-t border-zinc-800">
          <td colSpan={colSpan} className="px-3 py-3">
            <div className="text-xs text-zinc-400 mb-2">Top 10</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {b.top10.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-zinc-900 rounded px-2 py-1.5"
                >
                  <span
                    className={`inline-block w-6 text-center text-xs rounded ${rankBgClass(i + 1)}`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate flex-1 text-sm">{e.name}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {formatIdleon(e.score)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Rank delta = oldRank - newRank, so positive = climbed (rank number went
// DOWN, which is good). Green for improvement, red for regression.
function RankDeltaBadge({ delta }: { delta: BoardDelta | undefined }) {
  if (!delta || delta.status === "nodata") {
    return <span className="text-zinc-700">—</span>;
  }
  const v = delta.rankDelta ?? 0;
  if (v === 0) return <span className="text-zinc-500">=</span>;
  if (v > 0) {
    return <span className="text-emerald-400 font-semibold">▲ {v}</span>;
  }
  return <span className="text-red-400 font-semibold">▼ {-v}</span>;
}

function ScoreDeltaText({ delta }: { delta: BoardDelta | undefined }) {
  if (!delta || delta.status === "nodata") {
    return <span className="text-zinc-700">—</span>;
  }
  if (delta.scoreDelta === null || delta.scoreDelta === 0) {
    return <span className="text-zinc-500">—</span>;
  }
  if (delta.scoreDelta > 0) {
    return (
      <span className="text-emerald-400">+{formatIdleon(delta.scoreDelta)}</span>
    );
  }
  return (
    <span className="text-red-400">−{formatIdleon(-delta.scoreDelta)}</span>
  );
}
