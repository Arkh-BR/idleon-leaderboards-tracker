"use client";

import { useEffect, useMemo, useState } from "react";
import { computeTome, type TomeResult, type TomeRow } from "@/lib/tome/compute";
import {
  calcPointsPercent,
  maxPtsForBonus,
  quantityForPts,
} from "@/lib/tome/math";
import { TIER_META, tierForPct, type TomeTier } from "@/lib/tome/tier";
import { TOP_PLAYERS, type TopPlayerEntry } from "@/lib/tome/topPlayers";
import { formatIdleon } from "@/lib/format";

const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const CLASSIFICATIONS_KEY = "idleon-leaderboards.tome.userClassifications";
const TIER_ORDER: TomeTier[] = ["blue", "gold", "silver", "bronze", "missing"];

// Classification ID auto-assigned when the task is fully maxed (tier === "blue").
// The user can still pick a different label if they want, but the panel always
// renders "Capped" for these tasks.
const CAPPED_ID = 12;

// Visual style + display order for the user-defined classification tags
// from the BEST TOME sheet (column D).
const CLASSIFICATION_STYLE: Record<
  number,
  { label: string; chip: string; sortRank: number }
> = {
  1: { label: "Priority", chip: "bg-red-900/40 text-red-300 border-red-700/50", sortRank: 0 },
  3: { label: "Doable", chip: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50", sortRank: 1 },
  4: { label: "Time Gated", chip: "bg-amber-900/40 text-amber-300 border-amber-700/50", sortRank: 2 },
  5: { label: "Lucky Gated", chip: "bg-purple-900/40 text-purple-300 border-purple-700/50", sortRank: 3 },
  9: { label: "Event Gated", chip: "bg-orange-900/40 text-orange-300 border-orange-700/50", sortRank: 4 },
  12: { label: "Capped", chip: "bg-sky-900/40 text-sky-300 border-sky-700/50", sortRank: 5 },
};
const CLASSIFICATION_IDS = [1, 3, 4, 5, 9, 12] as const;

type SortKey = "tier" | "class" | "task" | "pts" | "gap" | "next" | "max" | "pctRemaining";
type SortDir = "asc" | "desc";

type EnrichedRow = TomeRow & {
  pct: number | null;
  tier: TomeTier;
  maxPts: number;                    // theoretical curve ceiling
  rawForNextPt: number | null;       // raw value needed to reach pts+1
  rawForMaxPts: number | null;       // raw value needed to reach maxPts
  ptsGapToMax: number;               // gap to theoretical max
  top: TopPlayerEntry | null;        // best observed player snapshot
  ptsGapToTop: number;               // gap to top player's pts (>=0)
  classification: number | null;     // effective classification (user choice OR auto-Capped)
  userClassification: number | null; // raw user pick (no auto-override)
  cappedByMax: boolean;              // true when forced to Capped by tier === "blue"
};

export default function BestTomePanel() {
  const [result, setResult] = useState<TomeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TomeTier | "all">("all");
  const [classFilter, setClassFilter] = useState<number | "all" | "none">("all");
  const [hideMaxed, setHideMaxed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showTopPlayer, setShowTopPlayer] = useState(false);
  // Per-task user classification map (taskName → classification ID). Saved in
  // localStorage so each player keeps their own categorization across sessions.
  const [userClass, setUserClass] = useState<Record<string, number>>({});

  // Hydrate from the same localStorage key the Raw analysis writes to, so
  // pasting in either sub-tab feeds both views.
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "";
    } catch {}
    if (saved) {
      try {
        setResult(computeTome(saved));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    // User classifications — separate localStorage entry.
    try {
      const raw = localStorage.getItem(CLASSIFICATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") setUserClass(parsed);
      }
    } catch {}
  }, []);

  // value semantics:
  //   number 1/3/4/5/9 → user picked a classification
  //   0                → user explicitly cleared (overrides snapshot default)
  //   null             → wipe entry (revert to snapshot default if any)
  function setClassFor(taskName: string, value: number | null) {
    setUserClass((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[taskName];
      } else {
        next[taskName] = value;
      }
      try {
        localStorage.setItem(CLASSIFICATIONS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function resetAllClassifications() {
    setUserClass({});
    try {
      localStorage.removeItem(CLASSIFICATIONS_KEY);
    } catch {}
  }

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
      const top = TOP_PLAYERS[r.task] ?? null;
      const ptsGapToTop =
        top && top.pts !== null ? Math.max(0, top.pts - currentPts) : 0;
      // Auto-Capped ONLY when the user is at (or above) the theoretical
      // maximum points for the task's curve — i.e., literally maxed out.
      // The blue tier (99.9% of asymptote) is NOT enough.
      const cappedByMax = currentPts > 0 && maxPts > 0 && currentPts >= maxPts;

      // Default classification: the snapshot value from the sheet, EXCEPT we
      // never use 12 (Capped) as a default — Capped is reserved for the
      // auto-rule above. User can still pick any non-Capped value.
      const snapshotDefault =
        top && top.classification !== null && top.classification !== CAPPED_ID
          ? top.classification
          : null;

      const rawUserPick = userClass[r.task]; // undefined | 0 | 1/3/4/5/9
      // userPick semantics:
      //   undefined → user never touched → use snapshot default
      //   0         → user explicitly cleared → no chip
      //   1/3/4/5/9 → user's pick
      const effectiveUserPick =
        rawUserPick === undefined ? snapshotDefault : rawUserPick === 0 ? null : rawUserPick;

      const classification = cappedByMax ? CAPPED_ID : effectiveUserPick;
      return {
        ...r, pct, tier, maxPts, rawForNextPt, rawForMaxPts, ptsGapToMax,
        top, ptsGapToTop,
        classification, userClassification: effectiveUserPick, cappedByMax,
      };
    });
  }, [result, userClass]);

  const totals = useMemo(() => {
    if (enriched.length === 0) {
      return { total: 0, theoretical: 0, observed: 0, behind: 0, covered: 0, count: 0 };
    }
    let total = 0;
    let theoretical = 0;
    let observed = 0;
    let covered = 0;
    for (const r of enriched) {
      total += r.pts ?? 0;
      theoretical += r.maxPts;
      observed += r.top?.pts ?? r.maxPts; // fall back to theoretical if no snapshot
      if (r.pts !== null) covered++;
    }
    return {
      total,
      theoretical,
      observed,
      behind: observed - total,
      covered,
      count: enriched.length,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (tierFilter !== "all" && r.tier !== tierFilter) return false;
      if (classFilter === "none") {
        if (r.classification !== null) return false;
      } else if (classFilter !== "all") {
        if (r.classification !== classFilter) return false;
      }
      if (hideMaxed && r.tier === "blue") return false;
      if (q && !r.task.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, tierFilter, classFilter, hideMaxed]);

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
        case "class": {
          const ac = a.classification;
          const bc = b.classification;
          av = ac !== null && CLASSIFICATION_STYLE[ac] ? CLASSIFICATION_STYLE[ac].sortRank : 999;
          bv = bc !== null && CLASSIFICATION_STYLE[bc] ? CLASSIFICATION_STYLE[bc].sortRank : 999;
          break;
        }
        case "task":
          av = a.task;
          bv = b.task;
          break;
        case "pts":
          av = a.pts ?? -1;
          bv = b.pts ?? -1;
          break;
        case "gap":
          // Sort by gap to top player (more actionable than theoretical max).
          av = a.ptsGapToTop;
          bv = b.ptsGapToTop;
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
        <select
          value={String(classFilter)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "all") setClassFilter("all");
            else if (v === "none") setClassFilter("none");
            else setClassFilter(Number(v));
          }}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          title="Filter by classification — your personal categorization"
        >
          <option value="all">All classes</option>
          <option value="none">Unclassified</option>
          {CLASSIFICATION_IDS.map((id) => (
            <option key={id} value={id}>
              {CLASSIFICATION_STYLE[id].label}
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
        {Object.keys(userClass).length > 0 && (
          <button
            onClick={() => {
              if (confirm("Clear all your classifications? This can't be undone.")) {
                resetAllClassifications();
              }
            }}
            className="text-xs text-zinc-500 hover:text-red-400 underline"
            title={`${Object.keys(userClass).length} task(s) classified`}
          >
            Reset classifications
          </button>
        )}
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
                title="Achievement progress vs the curve max (bronze < 40% < silver < 75% < gold < 99.9% ≤ maxed)"
              >
                Tier{sortArrow("tier")}
              </th>
              <th
                className="px-2 py-2 text-left cursor-pointer hover:bg-zinc-800 w-28 hidden md:table-cell"
                onClick={() => toggleSort("class")}
                title="User-defined classification from the BEST TOME sheet"
              >
                Class{sortArrow("class")}
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
                className="px-3 py-2 text-right cursor-pointer hover:bg-zinc-800 w-28"
                onClick={() => toggleSort("gap")}
                title="Pts gap to the top observed player on this task"
              >
                Gap vs top{sortArrow("gap")}
              </th>
              {showTopPlayer && (
                <>
                  <th className="px-3 py-2 text-left bg-blue-950/20">Top player</th>
                  <th className="px-3 py-2 text-right bg-blue-950/20">Top raw</th>
                  <th className="px-3 py-2 text-right bg-blue-950/20">Top pts</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <BestTomeRow
                key={r.idx}
                row={r}
                showTopPlayer={showTopPlayer}
                onClassChange={setClassFor}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showTopPlayer && (
        <p className="text-xs text-zinc-500">
          Top-player snapshot from the &ldquo;Antho and Arkh&rsquo;s Tome Sheet&rdquo;
          BEST TOME tab, captured 2026-05-20. A live IT-scraper that refreshes
          this nightly is planned next.
        </p>
      )}
    </div>
  );
}

function nextPtCost(r: EnrichedRow): number | null {
  if (r.rawValue === null || r.rawForNextPt === null) return null;
  return r.rawForNextPt - Number(r.rawValue);
}

// Editable per-task classification chip. Renders a styled <select> that looks
// like the chip badge. The first-time default comes from the snapshot in the
// BEST TOME sheet; once the user picks anything (including "— none —") their
// choice is persisted and overrides the snapshot for that task.
//
// When the task is at the theoretical curve maximum (cappedByMax === true),
// the chip is LOCKED to "Capped" and the picker is hidden.
function ClassificationSelect({
  row: r,
  onChange,
}: {
  row: EnrichedRow;
  onChange: (taskName: string, value: number | null) => void;
}) {
  if (r.cappedByMax) {
    return (
      <span
        className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border ${CLASSIFICATION_STYLE[CAPPED_ID].chip}`}
        title="Auto-classified as Capped because pts have reached the theoretical max"
      >
        Capped
      </span>
    );
  }

  // Currently-shown value = the user's effective classification (snapshot OR
  // user pick, with explicit none = null).
  const effective = r.userClassification;
  const meta = effective !== null ? CLASSIFICATION_STYLE[effective] : null;
  const chipClass = meta?.chip ?? "bg-zinc-900 text-zinc-500 border-zinc-800";
  const selectValue = effective === null ? "" : String(effective);

  return (
    <select
      value={selectValue}
      onChange={(e) => {
        const v = e.target.value;
        // "" → store 0 (explicit clear, even if snapshot has a default)
        // numeric → store the user's pick
        onChange(r.task, v === "" ? 0 : Number(v));
      }}
      className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border cursor-pointer outline-none ${chipClass}`}
      title="Click to classify — saved locally on your device. Default comes from the BEST TOME sheet."
    >
      <option value="" className="bg-zinc-900 normal-case text-zinc-400">
        — none —
      </option>
      {CLASSIFICATION_IDS.filter((id) => id !== CAPPED_ID).map((id) => (
        <option key={id} value={id} className="bg-zinc-900 normal-case text-zinc-200">
          {CLASSIFICATION_STYLE[id].label}
        </option>
      ))}
    </select>
  );
}

function HeroKPIs({
  totals,
}: {
  totals: {
    total: number;
    theoretical: number;
    observed: number;
    behind: number;
    covered: number;
    count: number;
  };
}) {
  // Primary % progress is against what top players have actually achieved —
  // that's the realistic ceiling, not the formula asymptote.
  const pctObserved =
    totals.observed > 0 ? (totals.total / totals.observed) * 100 : 0;
  const pctTheoretical =
    totals.theoretical > 0 ? (totals.total / totals.theoretical) * 100 : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border border-gold/40 bg-zinc-900/50 p-4 col-span-2 sm:col-span-1">
        <div className="text-xs text-zinc-400 mb-1">Your total pts</div>
        <div className="text-3xl font-bold text-gold tabular-nums">
          {totals.total.toLocaleString()}
        </div>
        <div className="mt-2 h-1.5 bg-zinc-800 rounded overflow-hidden">
          <div
            className="h-full bg-gold"
            style={{ width: `${Math.min(100, pctObserved)}%` }}
          />
        </div>
        <div className="text-xs text-zinc-500 mt-1 tabular-nums">
          {pctObserved.toFixed(1)}% of observed top
        </div>
      </div>
      <KpiCard
        label="Observed top max"
        sub="sum of top players per task"
        value={totals.observed.toLocaleString()}
        accent="zinc"
      />
      <KpiCard
        label="Behind top players"
        sub="realistic gap to close"
        value={totals.behind > 0 ? `−${totals.behind.toLocaleString()}` : "0"}
        accent={totals.behind > 0 ? "red" : "green"}
      />
      <KpiCard
        label="Theoretical max"
        sub={`${pctTheoretical.toFixed(1)}% reached`}
        value={totals.theoretical.toLocaleString()}
        accent="blue"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function BestTomeRow({
  row: r,
  showTopPlayer,
  onClassChange,
}: {
  row: EnrichedRow;
  showTopPlayer: boolean;
  onClassChange: (taskName: string, value: number | null) => void;
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
      <td className="px-2 py-2 hidden md:table-cell">
        <ClassificationSelect row={r} onChange={onClassChange} />
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
        {r.top === null || r.top.pts === null ? (
          <span className="text-zinc-600 text-xs">no data</span>
        ) : r.ptsGapToTop === 0 ? (
          <span className="text-sky-400 text-xs">tied / ahead</span>
        ) : (
          <span className="text-zinc-300">−{r.ptsGapToTop}</span>
        )}
      </td>
      {showTopPlayer && (
        <>
          <td className="px-3 py-2 bg-blue-950/10 text-zinc-300">
            {r.top?.player ? (
              <div>
                <div>{r.top.player}</div>
                {r.top.date && (
                  <div className="text-[10px] text-zinc-500" title="Date this datapoint was captured">
                    {r.top.date}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-zinc-600 italic text-xs">—</span>
            )}
          </td>
          <td className="px-3 py-2 text-right tabular-nums bg-blue-950/10 text-zinc-300">
            {r.top?.raw !== null && r.top?.raw !== undefined ? formatIdleon(r.top.raw) : <span className="text-zinc-600 italic text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right tabular-nums bg-blue-950/10 text-zinc-300">
            {r.top?.pts !== null && r.top?.pts !== undefined ? r.top.pts : <span className="text-zinc-600 italic text-xs">—</span>}
          </td>
        </>
      )}
    </tr>
  );
}
