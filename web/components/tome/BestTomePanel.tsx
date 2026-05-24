"use client";

import { useEffect, useMemo, useState } from "react";
import { computeTome, type TomeResult, type TomeRow } from "@/lib/tome/compute";
import {
  calcPointsPercent,
  maxPtsForBonus,
  quantityForPts,
} from "@/lib/tome/math";
import { TIER_META, tierForPct, type TomeTier } from "@/lib/tome/tier";
import { formatIdleon } from "@/lib/format";

const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const TIER_ORDER: TomeTier[] = ["blue", "gold", "silver", "bronze", "missing"];

type SortKey = "tier" | "task" | "pts" | "gap" | "next" | "max" | "pctRemaining";
type SortDir = "asc" | "desc";

type EnrichedRow = TomeRow & {
  pct: number | null;
  tier: TomeTier;
  maxPts: number;
  rawForNextPt: number | null; // raw value needed to reach pts+1
  rawForMaxPts: number | null; // raw value needed to reach maxPts
  ptsGapToMax: number;
};

export default function BestTomePanel() {
  const [result, setResult] = useState<TomeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TomeTier | "all">("all");
  const [hideMaxed, setHideMaxed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showTopPlayer, setShowTopPlayer] = useState(false);

  // Hydrate from the same localStorage key the Raw analysis writes to, so
  // pasting in either sub-tab feeds both views.
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "";
    } catch {}
    if (!saved) return;
    try {
      setResult(computeTome(saved));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const enriched: EnrichedRow[] = useMemo(() => {
    if (!result) return [];
    return result.rows.map((r) => {
      const maxPts = maxPtsForBonus(r.bonus);
      const pct =
        r.bonus && r.rawValue !== null
          ? calcPointsPercent(r.bonus, Number(r.rawValue))
          : null;
      const tier = tierForPct(pct);
      const currentPts = r.pts ?? 0;
      const rawForNextPt = quantityForPts(r.bonus, currentPts + 1);
      const rawForMaxPts = quantityForPts(r.bonus, maxPts);
      const ptsGapToMax = Math.max(0, maxPts - currentPts);
      return { ...r, pct, tier, maxPts, rawForNextPt, rawForMaxPts, ptsGapToMax };
    });
  }, [result]);

  const totals = useMemo(() => {
    if (enriched.length === 0) {
      return { total: 0, max: 0, behind: 0, covered: 0, count: 0 };
    }
    let total = 0;
    let max = 0;
    let covered = 0;
    for (const r of enriched) {
      total += r.pts ?? 0;
      max += r.maxPts;
      if (r.pts !== null) covered++;
    }
    return { total, max, behind: max - total, covered, count: enriched.length };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (tierFilter !== "all" && r.tier !== tierFilter) return false;
      if (hideMaxed && r.tier === "blue") return false;
      if (q && !r.task.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, tierFilter, hideMaxed]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "tier":
          av = TIER_ORDER.indexOf(a.tier);
          bv = TIER_ORDER.indexOf(b.tier);
          break;
        case "task":
          av = a.task;
          bv = b.task;
          break;
        case "pts":
          av = a.pts ?? -1;
          bv = b.pts ?? -1;
          break;
        case "gap":
          av = a.ptsGapToMax;
          bv = b.ptsGapToMax;
          break;
        case "next":
          // "next" = absolute raw delta to reach +1 pt (lower = easier win).
          av = nextPtCost(a) ?? Number.MAX_SAFE_INTEGER;
          bv = nextPtCost(b) ?? Number.MAX_SAFE_INTEGER;
          break;
        case "max":
          av = a.maxPts;
          bv = b.maxPts;
          break;
        case "pctRemaining":
          av = (a.maxPts - (a.pts ?? 0)) / Math.max(1, a.maxPts);
          bv = (b.maxPts - (b.pts ?? 0)) / Math.max(1, b.maxPts);
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      // Reasonable default direction per column.
      setSortDir(k === "task" || k === "tier" ? "asc" : "desc");
    }
  }

  function sortArrow(k: SortKey) {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  if (error) {
    return (
      <div className="bg-red-950/50 border border-red-800 rounded p-3 text-sm">
        <strong className="text-red-400">Error:</strong> {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded p-6 text-center text-sm text-zinc-400">
        Paste your raw JSON in the{" "}
        <span className="text-zinc-200 font-medium">Raw analysis</span> tab
        first. Once you click <em>Calculate Tome</em>, this view auto-populates
        with the same data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeroKPIs totals={totals} />

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search task…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as TomeTier | "all")}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        >
          <option value="all">All tiers</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {TIER_META[t].label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={hideMaxed}
            onChange={(e) => setHideMaxed(e.target.checked)}
            className="accent-gold"
          />
          Hide maxed
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={showTopPlayer}
            onChange={(e) => setShowTopPlayer(e.target.checked)}
            className="accent-gold"
          />
          Show top player
        </label>
        <span className="text-xs text-zinc-500 ml-auto">
          {sorted.length} / {enriched.length} tasks
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th
                className="px-2 py-2 text-left cursor-pointer hover:bg-zinc-800 w-20"
                onClick={() => toggleSort("tier")}
              >
                Tier{sortArrow("tier")}
              </th>
              <th
                className="px-3 py-2 text-left cursor-pointer hover:bg-zinc-800"
                onClick={() => toggleSort("task")}
              >
                Task{sortArrow("task")}
              </th>
              <th className="px-3 py-2 text-right hidden md:table-cell w-32">
                Your raw
              </th>
              <th className="px-3 py-2 text-right hidden lg:table-cell w-32">
                +1 pt at
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:bg-zinc-800 w-32"
                onClick={() => toggleSort("pts")}
              >
                Pts{sortArrow("pts")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:bg-zinc-800 w-24"
                onClick={() => toggleSort("max")}
              >
                Max{sortArrow("max")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:bg-zinc-800 w-24"
                onClick={() => toggleSort("gap")}
              >
                Gap{sortArrow("gap")}
              </th>
              {showTopPlayer && (
                <>
                  <th className="px-3 py-2 text-left bg-blue-950/30">Top player</th>
                  <th className="px-3 py-2 text-right bg-blue-950/30">Top raw</th>
                  <th className="px-3 py-2 text-right bg-blue-950/30">Top pts</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <BestTomeRow key={r.idx} row={r} showTopPlayer={showTopPlayer} />
            ))}
          </tbody>
        </table>
      </div>

      {showTopPlayer && (
        <p className="text-xs text-zinc-500">
          Top-player data not yet wired — the 3 right columns are placeholders.
          Scraping the IT top-10 tome and per-leaderboard #1 is planned next.
        </p>
      )}
    </div>
  );
}

function nextPtCost(r: EnrichedRow): number | null {
  if (r.rawValue === null || r.rawForNextPt === null) return null;
  return r.rawForNextPt - Number(r.rawValue);
}

function HeroKPIs({
  totals,
}: {
  totals: { total: number; max: number; behind: number; covered: number; count: number };
}) {
  const pct = totals.max > 0 ? (totals.total / totals.max) * 100 : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border border-gold/40 bg-zinc-900/50 p-4">
        <div className="text-xs text-zinc-400 mb-1">Your total pts</div>
        <div className="text-3xl font-bold text-gold tabular-nums">
          {totals.total.toLocaleString()}
        </div>
        <div className="mt-2 h-1.5 bg-zinc-800 rounded overflow-hidden">
          <div className="h-full bg-gold" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="text-xs text-zinc-500 mt-1 tabular-nums">
          {pct.toFixed(1)}% of max
        </div>
      </div>
      <KpiCard label="Max possible" value={totals.max.toLocaleString()} accent="zinc" />
      <KpiCard
        label="Behind max"
        value={totals.behind.toLocaleString()}
        accent={totals.behind > 0 ? "red" : "green"}
      />
      <KpiCard
        label="Coverage"
        value={`${totals.covered} / ${totals.count}`}
        accent="blue"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "zinc" | "red" | "green" | "blue";
}) {
  const colors: Record<typeof accent, string> = {
    zinc: "text-zinc-200 border-zinc-700",
    red: "text-red-400 border-red-800/50",
    green: "text-green-400 border-green-800/50",
    blue: "text-sky-400 border-sky-800/50",
  };
  return (
    <div className={`rounded-lg border bg-zinc-900/40 p-4 ${colors[accent]}`}>
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function BestTomeRow({
  row: r,
  showTopPlayer,
}: {
  row: EnrichedRow;
  showTopPlayer: boolean;
}) {
  const meta = TIER_META[r.tier];
  const pts = r.pts ?? 0;
  const pctOfMax = r.maxPts > 0 ? (pts / r.maxPts) * 100 : 0;
  const cost = nextPtCost(r);
  return (
    <tr className="border-t border-zinc-800 hover:bg-zinc-900/40">
      <td className="px-2 py-2">
        <span
          className={`inline-block text-xs font-semibold rounded px-2 py-0.5 border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
        >
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-2 font-medium">{r.task}</td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-300 hidden md:table-cell">
        {r.rawValue === null ? <span className="text-zinc-600">—</span> : formatIdleon(r.rawValue)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-400 hidden lg:table-cell">
        {r.tier === "blue" ? (
          <span className="text-sky-400 text-xs">maxed</span>
        ) : r.rawForNextPt === null ? (
          <span className="text-zinc-600 text-xs">unreachable</span>
        ) : (
          <>
            <div>{formatIdleon(r.rawForNextPt)}</div>
            {cost !== null && cost > 0 && (
              <div className="text-xs text-zinc-500">
                +{formatIdleon(cost)} to gain 1
              </div>
            )}
          </>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <div className="font-semibold" style={{ color: meta.hex }}>
          {pts}
          <span className="text-zinc-500 text-xs"> / {r.maxPts}</span>
        </div>
        <div className="mt-1 h-1 bg-zinc-800 rounded overflow-hidden">
          <div
            className="h-full"
            style={{ width: `${Math.min(100, pctOfMax)}%`, background: meta.hex }}
          />
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r.maxPts}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {r.ptsGapToMax === 0 ? (
          <span className="text-sky-400 text-xs">—</span>
        ) : (
          <span className="text-zinc-300">-{r.ptsGapToMax}</span>
        )}
      </td>
      {showTopPlayer && (
        <>
          <td className="px-3 py-2 text-zinc-500 italic text-xs">—</td>
          <td className="px-3 py-2 text-right text-zinc-500 italic text-xs">—</td>
          <td className="px-3 py-2 text-right text-zinc-500 italic text-xs">—</td>
        </>
      )}
    </tr>
  );
}
