"use client";

import { useMemo, useState } from "react";
import type { BoardResult } from "@/app/api/leaderboards/route";
import { formatIdleon, formatPct } from "@/lib/format";
import { rankBgClass } from "@/lib/rank";

type SortKey = "category" | "label" | "rank" | "score" | "pct";
type SortDir = "asc" | "desc";

type Props = {
  boards: BoardResult[];
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

export default function LeaderboardsTable({ boards }: Props) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

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
          placeholder="Buscar leaderboard…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
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
                Categoria{sortIndicator("category")}
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
              <th className="text-right px-3 py-2 hidden md:table-cell">
                Diff vs #1
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:bg-zinc-800 hidden md:table-cell w-24"
                onClick={() => toggleSort("pct")}
              >
                % de #1{sortIndicator("pct")}
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
}: {
  board: BoardResult;
  top1: { name: string; score: number } | undefined;
  diff: number | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
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
            aria-label={isOpen ? "Recolher" : "Expandir top 10"}
          >
            {isOpen ? "▲" : "▼"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-zinc-950/60 border-t border-zinc-800">
          <td colSpan={8} className="px-3 py-3">
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
