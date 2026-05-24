"use client";

import { useEffect, useMemo, useState } from "react";
import { computeTome, type TomeResult, type TomeRow } from "@/lib/tome/compute";
import {
  calcPointsPercent,
  isInvertedCurve,
  maxPtsForBonus,
  quantityForPts,
} from "@/lib/tome/math";
import { TIER_META, tierForPct, type TomeTier } from "@/lib/tome/tier";
import { TOP_PLAYERS, type TopPlayerEntry } from "@/lib/tome/topPlayers";
import { DEFAULT_CLASSIFICATIONS } from "@/lib/tome/defaultClassifications";
import { formatIdleon } from "@/lib/format";

const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const CLASSIFICATIONS_KEY = "idleon-leaderboards.tome.userClassifications";
const SNAPSHOT_KEY = "idleon-leaderboards.tome.ptsSnapshot";

// Shape stored under SNAPSHOT_KEY — a baseline of {taskName → pts} captured
// at savedAt. The Δ column shows currentPts - snapshotPts so the user can
// track how their tome score moved since the last save.
type PtsSnapshot = {
  savedAt: string; // ISO timestamp
  pts: Record<string, number>;
};
const TIER_ORDER: TomeTier[] = ["blue", "gold", "silver", "bronze", "missing"];

// Classification ID auto-assigned when the task is fully maxed (tier === "blue").
// The user can still pick a different label if they want, but the panel always
// renders "Capped" for these tasks.
const CAPPED_ID = 12;

// Visual style + display order for the user-defined classification tags
// from the BEST TOME sheet (column D). Hex pair is for the <option> styling
// inside the chip-shaped <select> (browsers don't apply Tailwind classes to
// dropdown items, so we inline the colors).
const CLASSIFICATION_STYLE: Record<
  number,
  { label: string; chip: string; bg: string; fg: string; sortRank: number }
> = {
  1: { label: "Priority",    chip: "bg-red-900/40 text-red-300 border-red-700/50",         bg: "#450a0a", fg: "#fca5a5", sortRank: 0 },
  3: { label: "Doable",      chip: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50", bg: "#022c22", fg: "#6ee7b7", sortRank: 1 },
  4: { label: "Time Gated",  chip: "bg-amber-900/40 text-amber-300 border-amber-700/50",   bg: "#451a03", fg: "#fcd34d", sortRank: 2 },
  5: { label: "Lucky Gated", chip: "bg-purple-900/40 text-purple-300 border-purple-700/50", bg: "#2e1065", fg: "#d8b4fe", sortRank: 3 },
  9: { label: "Update Gated", chip: "bg-orange-900/40 text-orange-300 border-orange-700/50", bg: "#431407", fg: "#fdba74", sortRank: 4 },
  12: { label: "Capped",     chip: "bg-sky-900/40 text-sky-300 border-sky-700/50",          bg: "#082f49", fg: "#7dd3fc", sortRank: 5 },
};
const CLASSIFICATION_IDS = [1, 3, 4, 5, 9, 12] as const;

type SortKey =
  | "default" // class asc (Priority → Capped → Unclassified), tie-break: gap desc
  | "tier"
  | "class"
  | "task"
  | "pts"
  | "delta"
  | "gap"
  | "next"
  | "pctRemaining";
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
  snapshotPts: number | null;        // saved baseline pts for this task (null if no snapshot)
  ptsDelta: number | null;           // current pts - snapshot pts (null if no baseline)
};

export default function BestTomePanel() {
  const [result, setResult] = useState<TomeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TomeTier | "all">("all");
  const [classFilter, setClassFilter] = useState<number | "all" | "none">("all");
  const [hideMaxed, setHideMaxed] = useState(false);
  // Default sort: compound — group by classification (Priority first), then
  // within each group order by Gap vs top descending (biggest opportunities
  // first). User can switch via column headers; "Smart sort" button below
  // restores this view.
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // Per-task user classification map (taskName → classification ID). Saved in
  // localStorage so each player keeps their own categorization across sessions.
  const [userClass, setUserClass] = useState<Record<string, number>>({});
  // Baseline pts snapshot (taskName → pts captured at savedAt). Drives the Δ
  // column so the user can see how their pts moved since they last saved.
  const [snapshot, setSnapshot] = useState<PtsSnapshot | null>(null);

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
    // Pts snapshot — separate localStorage entry.
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PtsSnapshot;
        if (parsed && typeof parsed === "object" && parsed.pts) {
          setSnapshot(parsed);
        }
      }
    } catch {}
  }, []);

  // Capture every task's current pts as the new baseline. Tasks without
  // a current pts value are still recorded as 0 so future comparisons treat
  // them as "started from zero".
  function saveSnapshot() {
    if (!result) return;
    const pts: Record<string, number> = {};
    for (const r of result.rows) {
      pts[r.task] = r.pts ?? 0;
    }
    const next: PtsSnapshot = { savedAt: new Date().toISOString(), pts };
    setSnapshot(next);
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    } catch {}
  }


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

      // Default classification: prefer the hand-curated DEFAULT_CLASSIFICATIONS
      // override (web/lib/tome/defaultClassifications.ts) when present, fall
      // back to the snapshot value from the sheet. We never use 12 (Capped) as
      // a default — Capped is reserved for the auto-rule above.
      const overridePick = DEFAULT_CLASSIFICATIONS[r.task];
      const snapshotDefault =
        overridePick !== undefined
          ? overridePick === CAPPED_ID
            ? null
            : overridePick
          : top && top.classification !== null && top.classification !== CAPPED_ID
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
      const snapshotPts =
        snapshot && r.task in snapshot.pts ? snapshot.pts[r.task] : null;
      const ptsDelta =
        snapshotPts !== null && r.pts !== null ? r.pts - snapshotPts : null;
      return {
        ...r, pct, tier, maxPts, rawForNextPt, rawForMaxPts, ptsGapToMax,
        top, ptsGapToTop,
        classification, userClassification: effectiveUserPick, cappedByMax,
        snapshotPts, ptsDelta,
      };
    });
  }, [result, userClass, snapshot]);

  const totals = useMemo(() => {
    if (enriched.length === 0) {
      return {
        total: 0, theoretical: 0, observed: 0, behind: 0, covered: 0,
        count: 0, deltaTotal: null as number | null,
      };
    }
    let total = 0;
    let theoretical = 0;
    let observed = 0;
    let covered = 0;
    let deltaSum = 0;
    let hasAnyDelta = false;
    for (const r of enriched) {
      total += r.pts ?? 0;
      theoretical += r.maxPts;
      observed += r.top?.pts ?? r.maxPts; // fall back to theoretical if no snapshot
      if (r.pts !== null) covered++;
      if (r.ptsDelta !== null) {
        deltaSum += r.ptsDelta;
        hasAnyDelta = true;
      }
    }
    return {
      total,
      theoretical,
      observed,
      behind: observed - total,
      covered,
      count: enriched.length,
      deltaTotal: hasAnyDelta ? deltaSum : null,
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
      // Strict capped rule (same as Auto-Capped + "+1 pt at maxed"): only hide
      // when the player literally reached the theoretical curve max. Blue tier
      // (99.9% of asymptote) is NOT enough to count as maxed.
      if (hideMaxed && r.cappedByMax) return false;
      if (q && !r.task.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, tierFilter, classFilter, hideMaxed]);

  const sorted = useMemo(() => {
    const arr = [...filtered];

    // Compound default: classification rank asc → ptsGapToTop desc.
    if (sortKey === "default") {
      const rank = (r: EnrichedRow) =>
        r.classification !== null && CLASSIFICATION_STYLE[r.classification]
          ? CLASSIFICATION_STYLE[r.classification].sortRank
          : 999;
      arr.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return b.ptsGapToTop - a.ptsGapToTop;
      });
      return arr;
    }

    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      // "default" is handled in the early-return above; TS narrows it out.
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
        case "delta":
          // Tasks without a snapshot baseline sort as -Infinity so they sink.
          av = a.ptsDelta ?? Number.NEGATIVE_INFINITY;
          bv = b.ptsDelta ?? Number.NEGATIVE_INFINITY;
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
      <HeroKPIs totals={totals} snapshotAt={snapshot?.savedAt ?? null} />

      <div className="flex flex-wrap gap-3 items-center p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/80">
        {/* Left group: search + filters */}
        <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[260px]">
          <input
            type="text"
            placeholder="Search task…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950/80 border border-zinc-700 rounded-md px-3 py-2 text-sm flex-1 min-w-[180px] focus:border-gold/50"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TomeTier | "all")}
            className="bg-zinc-950/80 border border-zinc-700 rounded-md px-3 py-2 text-sm"
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
            className="bg-zinc-950/80 border border-zinc-700 rounded-md px-3 py-2 text-sm"
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
        </div>

        {/* Right group: toggles + actions */}
        <div className="flex flex-wrap gap-2 items-center ml-auto">
          <label className="flex items-center gap-2 text-sm text-zinc-300 px-2.5 py-1.5 rounded-md border border-zinc-700/60 hover:border-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideMaxed}
              onChange={(e) => setHideMaxed(e.target.checked)}
              className="accent-gold"
            />
            Hide maxed
          </label>
          <button
            onClick={() => {
              setSortKey("default");
              setSortDir("desc");
            }}
            disabled={sortKey === "default"}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
              sortKey === "default"
                ? "border-gold/50 text-gold bg-gold/10 cursor-default"
                : "border-zinc-700 text-zinc-300 hover:border-gold hover:text-gold"
            }`}
            title="Group by class (Priority → Doable → Time Gated → Lucky Gated → Update Gated → Capped → Unclassified), then by Gap vs top descending within each group"
          >
            🎯 Smart sort
          </button>
          <button
            onClick={() => {
              if (
                !snapshot ||
                confirm(
                  "Overwrite the existing pts snapshot? The Δ column will reset to 0 for every task."
                )
              ) {
                saveSnapshot();
              }
            }}
            disabled={!result}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-emerald-700/40 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/40 disabled:opacity-40"
            title={
              snapshot
                ? `Saved on ${new Date(snapshot.savedAt).toLocaleDateString()} — click to overwrite with current pts`
                : "Save current pts as a baseline. The Δ column will show how each task's pts moved since this save."
            }
          >
            💾 {snapshot ? "Update snapshot" : "Save snapshot"}
          </button>
          {Object.keys(userClass).length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear all your classifications? This can't be undone.")) {
                  resetAllClassifications();
                }
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-red-400 hover:border-red-700/60"
              title={`${Object.keys(userClass).length} task(s) classified`}
            >
              Reset classes
            </button>
          )}
          <span className="text-xs text-zinc-500 tabular-nums pl-1">
            {sorted.length} / {enriched.length}
          </span>
        </div>
      </div>

      {/* Wrapper IS the scroll container (both axes) with a max-height. That
          makes thead's `sticky top-0` and Tier's `sticky left-0` work
          inside the same overflow context — the classic frozen-header table
          pattern. The page itself doesn't scroll the table; users scroll
          inside this pane. */}
      <div className="overflow-auto max-h-[calc(100vh-180px)] min-h-[400px] rounded-lg border border-zinc-800 relative">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="text-zinc-300">
            <tr className="[&>th]:bg-zinc-900 [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:border-b [&>th]:border-zinc-800">
              <th
                className="px-3 py-2.5 text-left cursor-pointer hover:bg-zinc-800/80 sticky left-0 !z-30 text-[11px] uppercase tracking-wider font-semibold border-r border-zinc-800 min-w-[220px]"
                onClick={() => toggleSort("task")}
              >
                Task{sortArrow("task")}
              </th>
              <th
                className="px-3 py-2.5 text-left cursor-pointer hover:bg-zinc-800/80 w-20 text-[11px] uppercase tracking-wider font-semibold"
                onClick={() => toggleSort("tier")}
                title="Achievement progress vs the curve max (bronze < 40% < silver < 75% < gold < 99.9% ≤ maxed)"
              >
                Tier{sortArrow("tier")}
              </th>
              <th
                className="px-3 py-2.5 text-left cursor-pointer hover:bg-zinc-800/80 w-32 text-[11px] uppercase tracking-wider font-semibold"
                onClick={() => toggleSort("class")}
                title="User-defined classification (auto-Capped when pts hit theoretical max)"
              >
                Classification{sortArrow("class")}
              </th>
              <th
                className="px-3 py-2.5 text-right w-40 text-[11px] uppercase tracking-wider font-semibold"
                title="Your raw value / top observed player's raw value"
              >
                Your QTY
              </th>
              <th className="px-3 py-2.5 text-right w-32 text-[11px] uppercase tracking-wider font-semibold">
                +1 pt at
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:bg-zinc-800/80 w-48 font-semibold"
                onClick={() => toggleSort("pts")}
                title="Your pts / top player's pts / theoretical max"
              >
                <div className="text-[11px] uppercase tracking-wider">
                  Points{sortArrow("pts")}
                </div>
                <div className="text-[10px] font-normal normal-case tracking-normal text-zinc-500 mt-0.5">
                  you / top / max
                </div>
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:bg-zinc-800/80 w-24 font-semibold"
                onClick={() => toggleSort("delta")}
                title={
                  snapshot
                    ? `Pts gained since the snapshot saved on ${new Date(snapshot.savedAt).toLocaleString()}`
                    : "Save a snapshot to start tracking pts gained over time."
                }
              >
                <div className="text-[11px] uppercase tracking-wider">
                  Δ Pts{sortArrow("delta")}
                </div>
                <div className="text-[10px] font-normal normal-case tracking-normal text-zinc-500 mt-0.5">
                  since save
                </div>
              </th>
              <th
                className="px-3 py-2.5 text-right cursor-pointer hover:bg-zinc-800/80 w-28 text-[11px] uppercase tracking-wider font-semibold"
                onClick={() => toggleSort("gap")}
                title="Pts gap to the top observed player on this task"
              >
                Gap vs top{sortArrow("gap")}
              </th>
              <th
                className="px-3 py-2.5 text-left w-40 border-l border-zinc-800/60 text-[11px] uppercase tracking-wider font-semibold"
                title="Top observed player per task — snapshot from the &ldquo;Antho and Arkh&rsquo;s Tome Sheet&rdquo; BEST TOME tab, captured 2026-05-20"
              >
                Top player
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <BestTomeRow
                key={r.idx}
                row={r}
                onClassChange={setClassFor}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-zinc-600 text-center">
        Top-player snapshot captured 2026-05-20 • a live IT-scraper that
        refreshes nightly is planned next.
      </p>
    </div>
  );
}

// Absolute raw delta to gain +1 pt. For inverted "Fastest Time" curves the
// player needs to DROP raw (improve time); for everything else they need to
// INCREASE raw. Sign is always positive — the caller decides how to label it.
function nextPtCost(r: EnrichedRow): number | null {
  if (r.rawValue === null || r.rawForNextPt === null) return null;
  return isInvertedCurve(r.bonus)
    ? Number(r.rawValue) - r.rawForNextPt
    : r.rawForNextPt - Number(r.rawValue);
}

// Strips the trailing "(in Seconds)" annotation that the IT data carries on
// fastest-time tasks. It's redundant in the UI (the inverted-curve hint
// already explains the direction).
function displayTaskName(name: string): string {
  return name.replace(/\s*\(in Seconds\)$/i, "");
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
        className={`inline-block text-[11px] font-semibold uppercase tracking-wide rounded-md px-2.5 py-1 border ${CLASSIFICATION_STYLE[CAPPED_ID].chip}`}
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
      className={`text-[11px] font-semibold uppercase tracking-wide rounded-md px-2.5 py-1 border cursor-pointer outline-none transition-colors ${chipClass}`}
      title="Click to classify — saved locally on your device. Default comes from the BEST TOME sheet."
    >
      <option
        value=""
        className="normal-case"
        style={{ background: "#18181b", color: "#a1a1aa" }}
      >
        — none —
      </option>
      {CLASSIFICATION_IDS.filter((id) => id !== CAPPED_ID).map((id) => {
        const s = CLASSIFICATION_STYLE[id];
        return (
          <option
            key={id}
            value={id}
            className="normal-case font-semibold"
            style={{ background: s.bg, color: s.fg }}
          >
            {s.label}
          </option>
        );
      })}
    </select>
  );
}

function HeroKPIs({
  totals,
  snapshotAt,
}: {
  totals: {
    total: number;
    theoretical: number;
    observed: number;
    behind: number;
    covered: number;
    count: number;
    deltaTotal: number | null;
  };
  snapshotAt: string | null;
}) {
  // Primary % progress is against what top players have actually achieved —
  // that's the realistic ceiling, not the formula asymptote.
  const pctObserved =
    totals.observed > 0 ? (totals.total / totals.observed) * 100 : 0;
  const pctTheoretical =
    totals.theoretical > 0 ? (totals.total / totals.theoretical) * 100 : 0;
  return (
    <div className="space-y-3">
      {/* Hero: total + progress bar spans the full width so it dominates the page */}
      <div className="rounded-xl border border-gold/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5 shadow-lg shadow-gold/5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">
              Your total tome pts
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-bold text-gold tabular-nums leading-none">
                {totals.total.toLocaleString()}
              </div>
              {totals.deltaTotal !== null && totals.deltaTotal !== 0 && (
                <div
                  className={`text-lg font-semibold tabular-nums ${
                    totals.deltaTotal > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                  title={
                    snapshotAt
                      ? `Net change since snapshot saved on ${new Date(snapshotAt).toLocaleString()}`
                      : undefined
                  }
                >
                  {totals.deltaTotal > 0 ? "+" : ""}
                  {totals.deltaTotal.toLocaleString()}
                </div>
              )}
            </div>
            <div className="text-xs text-zinc-500 mt-2 tabular-nums">
              {totals.covered} / {totals.count} tasks computed
              {snapshotAt && (
                <span className="ml-2 text-zinc-600">
                  · snap {new Date(snapshotAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>{pctObserved.toFixed(1)}% of observed top</span>
              <span className="text-zinc-600 tabular-nums">
                {totals.observed.toLocaleString()}
              </span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-amber-300 rounded-full transition-all"
                style={{ width: `${Math.min(100, pctObserved)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary stats: more compact row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Behind top players"
          sub="realistic gap to close"
          value={totals.behind > 0 ? `−${totals.behind.toLocaleString()}` : "0"}
          accent={totals.behind > 0 ? "red" : "green"}
          emphasis
        />
        <KpiCard
          label="Observed top max"
          sub="sum of top players"
          value={totals.observed.toLocaleString()}
          accent="zinc"
        />
        <KpiCard
          label="Theoretical max"
          sub={`${pctTheoretical.toFixed(1)}% reached`}
          value={totals.theoretical.toLocaleString()}
          accent="blue"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "zinc" | "red" | "green" | "blue";
  /** When true, gives the card a stronger border + ring so it pops as actionable. */
  emphasis?: boolean;
}) {
  const colors: Record<typeof accent, string> = {
    zinc: "text-zinc-200 border-zinc-700/80",
    red: "text-red-400 border-red-800/60",
    green: "text-green-400 border-green-800/60",
    blue: "text-sky-400 border-sky-800/60",
  };
  const emphasisRing: Record<typeof accent, string> = {
    zinc: "",
    red: "ring-1 ring-red-700/40 shadow-md shadow-red-900/20",
    green: "ring-1 ring-emerald-700/40 shadow-md shadow-emerald-900/20",
    blue: "",
  };
  return (
    <div
      className={`rounded-lg border bg-zinc-900/40 p-3 sm:p-4 ${colors[accent]} ${
        emphasis ? emphasisRing[accent] : ""
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-bold tabular-nums leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-zinc-500 mt-1.5 tabular-nums">{sub}</div>
      )}
    </div>
  );
}

function BestTomeRow({
  row: r,
  onClassChange,
}: {
  row: EnrichedRow;
  onClassChange: (taskName: string, value: number | null) => void;
}) {
  const meta = TIER_META[r.tier];
  const pts = r.pts ?? 0;
  const cost = nextPtCost(r);
  return (
    <tr className="group hover:bg-zinc-900/40 [&>td]:border-b [&>td]:border-zinc-800/60 transition-colors">
      <td className="px-3 py-3 font-medium text-zinc-100 sticky left-0 z-[1] bg-[#0d0d18] group-hover:bg-[#16161e] border-r border-zinc-800">
        {displayTaskName(r.task)}
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-block text-[11px] font-semibold uppercase tracking-wide rounded-md px-2.5 py-1 border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
        >
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3">
        <ClassificationSelect row={r} onChange={onClassChange} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-zinc-300">
        {r.rawValue === null ? (
          <span className="text-zinc-600">—</span>
        ) : (
          <>
            {formatIdleon(r.rawValue)}
            <span className="text-zinc-500 text-xs">
              {" / "}
              {r.top?.raw !== null && r.top?.raw !== undefined
                ? formatIdleon(r.top.raw)
                : "—"}
            </span>
          </>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-zinc-400">
        {r.cappedByMax ? (
          // Only "maxed" when literally at the theoretical curve ceiling
          // (same strict rule as auto-Capped).
          <span className="text-sky-400 text-xs">maxed</span>
        ) : r.rawForNextPt === null || cost === null || cost <= 0 ? (
          <span className="text-zinc-600 text-xs">—</span>
        ) : isInvertedCurve(r.bonus) ? (
          // Fastest-Time tasks (x2=3): lower raw = more pts. Show how many
          // units the player needs to DROP for +1 pt.
          <>
            <div className="text-zinc-200">{formatIdleon(r.rawForNextPt)}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              −{formatIdleon(cost)} to gain
            </div>
          </>
        ) : (
          <>
            <div className="text-zinc-200">{formatIdleon(r.rawForNextPt)}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              +{formatIdleon(cost)} to gain
            </div>
          </>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {(() => {
          // Show three checkpoints: your pts / top player's pts / theoretical max.
          // Progress bar denominator stays on the top player's pts (realistic
          // ceiling) so the visual stays actionable — theoretical max is mostly
          // unreachable on asymptotic curves and would flatten every bar.
          const topPts = r.top?.pts ?? null;
          const denom = topPts !== null && topPts > 0 ? topPts : r.maxPts;
          const pctOfDenom = denom > 0 ? (pts / denom) * 100 : 0;
          return (
            <>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-base font-bold tabular-nums" style={{ color: meta.hex }}>
                  {pts}
                </span>
                <span className="text-zinc-500 text-xs tabular-nums">
                  /{" "}
                  {topPts !== null && topPts > 0 ? topPts : "—"}
                </span>
                <span className="text-zinc-600 text-xs tabular-nums">
                  / {r.maxPts}
                </span>
              </div>
              <div className="mt-1.5 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, pctOfDenom)}%`, background: meta.hex }}
                />
              </div>
            </>
          );
        })()}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {r.ptsDelta === null ? (
          <span className="text-zinc-700 text-xs">—</span>
        ) : r.ptsDelta === 0 ? (
          <span className="text-zinc-500 text-xs">=</span>
        ) : r.ptsDelta > 0 ? (
          <span className="text-emerald-400 font-semibold">
            +{r.ptsDelta}
          </span>
        ) : (
          <span className="text-red-400 font-semibold">{r.ptsDelta}</span>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {r.top === null || r.top.pts === null ? (
          <span className="text-zinc-600 text-xs">no data</span>
        ) : r.ptsGapToTop === 0 ? (
          <span className="text-sky-400 text-xs">tied / ahead</span>
        ) : (
          <span className="text-zinc-300">−{r.ptsGapToTop}</span>
        )}
      </td>
      <td className="px-3 py-3 text-zinc-300 border-l border-zinc-800/60">
        {r.top?.player ? (
          <div>
            <div className="text-sm">{r.top.player}</div>
            {r.top.date && (
              <div
                className="text-[10px] text-zinc-500"
                title="Date this datapoint was captured"
              >
                {r.top.date}
              </div>
            )}
          </div>
        ) : (
          <span className="text-zinc-600 italic text-xs">no data</span>
        )}
      </td>
    </tr>
  );
}
