"use client";

// ============================================================================
// BiggestGainsPanel — the prescriptive "what to push next" view of the Tome
// Score tracker. Ranks the 118 tasks by ACTIONABLE Tome-score gain (gap to the
// top observed player, hiding time/luck/update-gated and capped tasks) and
// leads with a hero card naming the single biggest lever.
//
// It reads the same localStorage save the Best Tome / Raw tabs write, recomputes
// with computeTome, and reuses the exact enrichment + ranking math from
// lib/tome/gains.ts — no duplicated formulas.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { computeTome, type TomeResult } from "@/lib/tome/compute";
import {
  describeNextPoint,
  displayTaskName,
  enrichRows,
  gainPts,
  heroGain,
  rankGains,
  type EnrichedRow,
} from "@/lib/tome/gains";
import { formatIdleon } from "@/lib/format";

const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const CLASSIFICATIONS_KEY = "idleon-leaderboards.tome.userClassifications";

// Lean classification chip styles for the "Class" column. The Best Tome panel
// owns the editable chips; here they are read-only, so a small label+color map
// is all we need.
const CLASS_STYLE: Record<number, { label: string; chip: string }> = {
  1: { label: "Priority", chip: "bg-red-900/40 text-red-300 border-red-700/50" },
  3: { label: "Doable", chip: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" },
  4: { label: "Time Gated", chip: "bg-amber-900/40 text-amber-300 border-amber-700/50" },
  5: { label: "Lucky Gated", chip: "bg-purple-900/40 text-purple-300 border-purple-700/50" },
  9: { label: "Update Gated", chip: "bg-orange-900/40 text-orange-300 border-orange-700/50" },
  12: { label: "Capped", chip: "bg-sky-900/40 text-sky-300 border-sky-700/50" },
};

// Methodology note (kept as a string so the apostrophes render literally and
// don't trip react/no-unescaped-entities).
const METHODOLOGY =
  "Tome pts gain = how many points you'd gain if this task matched the top " +
  "observed player. By default we only show tasks you can push right now — " +
  "time-, luck- and update-gated tasks are hidden behind 'Include gated tasks'. " +
  "Values are a ceiling, not a one-level step; 'Next point' shows the cheapest " +
  "immediate move.";

const EMPTY_HINT =
  "Paste your raw JSON in the Paste your data here tab first. Once you click " +
  "Calculate Tome, this view auto-populates with the same data.";

// Edge copy (English) — see the design spec §4.
const NO_ACTIONABLE =
  "No actionable gains right now — your remaining gaps are time/luck/update " +
  "gated. Toggle 'Include gated tasks' to see them.";
const AT_CEILING =
  "You're at or above the top observed players on every task — nothing to gain " +
  "here. Nice.";

export default function BiggestGainsPanel({
  dungeonAsOne,
  onToggleDungeon,
}: {
  /** Shared "count Dungeon Rank as 1" toggle, owned by the page so it persists
   *  across tab switches / reloads. */
  dungeonAsOne: boolean;
  onToggleDungeon: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [result, setResult] = useState<TomeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userClass, setUserClass] = useState<Record<string, number>>({});
  // Actionable filter: gated tasks hidden by default (the prescriptive view).
  const [includeGated, setIncludeGated] = useState(false);

  // Hydrate from the same localStorage keys the other tabs use.
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "";
    } catch {}
    if (saved) setSource(saved);
    try {
      const raw = localStorage.getItem(CLASSIFICATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") setUserClass(parsed);
      }
    } catch {}
  }, []);

  // Re-score whenever the loaded save or the Dungeon-as-1 toggle changes. The
  // reference snapshot is bundled, so this is synchronous — no loading state.
  useEffect(() => {
    if (!source) {
      setResult(null);
      return;
    }
    try {
      setResult(computeTome(source, { dungeonRankAsOne: dungeonAsOne }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  }, [source, dungeonAsOne]);

  // Same enrichment as the Best Tome tab (gap-to-top, effective class, +1-pt
  // cost). The gains tab does not use the Δ snapshot, so pass null.
  const enriched: EnrichedRow[] = useMemo(
    () => (result ? enrichRows(result.rows, userClass, null) : []),
    [result, userClass]
  );

  const ranked = useMemo(
    () => rankGains(enriched, { includeGated }),
    [enriched, includeGated]
  );
  // Hero = biggest ACTIONABLE gain, independent of the gated toggle so peeking
  // at gated tasks never changes the recommendation.
  const hero = useMemo(() => heroGain(enriched), [enriched]);
  const anyGap = useMemo(() => enriched.some((r) => gainPts(r) > 0), [enriched]);

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
        {EMPTY_HINT}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hero && <HeroCard hero={hero} />}

      <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/80">
        <label className="flex items-center gap-2 text-sm text-zinc-300 px-2.5 py-1.5 rounded-md border border-zinc-700/60 hover:border-zinc-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeGated}
            onChange={(e) => setIncludeGated(e.target.checked)}
            className="accent-gold"
          />
          Include gated tasks
        </label>
        <button
          type="button"
          onClick={onToggleDungeon}
          aria-pressed={dungeonAsOne}
          title="Score the Dungeon Rank tome line as 1 — ignores dungeon progress in the total."
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ml-auto ${
            dungeonAsOne
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
              : "border-zinc-700 text-zinc-300 hover:border-amber-500/50 hover:text-amber-300"
          }`}
        >
          🏰 Dungeon = 1{dungeonAsOne ? " ✓" : ""}
        </button>
      </div>

      {ranked.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded p-6 text-center text-sm text-zinc-400">
          {anyGap ? NO_ACTIONABLE : AT_CEILING}
        </div>
      ) : (
        <GainsTable rows={ranked} heroTask={hero?.task ?? null} />
      )}

      <p className="text-[11px] text-zinc-500 leading-relaxed">{METHODOLOGY}</p>
    </div>
  );
}

function HeroCard({ hero }: { hero: EnrichedRow }) {
  const np = describeNextPoint(hero);
  const next =
    np.kind === "maxed"
      ? "Next point: maxed"
      : `Next point: ${np.drop ? "−" : "+"}${formatIdleon(np.cost)} → ${formatIdleon(
          np.target
        )}`;
  return (
    <div className="rounded-xl border border-gold/40 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5 shadow-lg shadow-gold/5">
      <div className="text-xl sm:text-2xl font-bold text-gold leading-tight">
        💡 Biggest win → push {displayTaskName(hero.task)} for{" "}
        <span className="tabular-nums">+{gainPts(hero)}</span> Tome pts
      </div>
      <div className="text-sm text-zinc-400 mt-2 tabular-nums">{next}</div>
    </div>
  );
}

function GainsTable({
  rows,
  heroTask,
}: {
  rows: EnrichedRow[];
  heroTask: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead className="text-zinc-300">
          <tr className="[&>th]:bg-zinc-900 [&>th]:border-b [&>th]:border-zinc-800 [&>th]:px-3 [&>th]:py-2">
            <th className="text-left">Task</th>
            <th className="text-right whitespace-nowrap">You → Top</th>
            <th className="text-right whitespace-nowrap">Tome pts gain</th>
            <th className="text-right whitespace-nowrap">Next point</th>
            <th className="text-center">Class</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <GainsRow key={r.idx} row={r} isHero={r.task === heroTask} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GainsRow({ row: r, isHero }: { row: EnrichedRow; isHero: boolean }) {
  const yourPts = r.pts ?? 0;
  // Use the top player's pts when we have a snapshot; otherwise fall back to the
  // theoretical max (the same denominator gainPts uses for that case).
  const target = r.top && r.top.pts !== null ? r.top.pts : r.maxPts;
  const np = describeNextPoint(r);
  const cls = r.classification;
  const clsMeta = cls !== null ? CLASS_STYLE[cls] : null;

  return (
    <tr className="[&>td]:border-b [&>td]:border-zinc-800/60 [&>td]:px-3 [&>td]:py-2.5 hover:bg-zinc-900/40">
      <td className="font-medium text-zinc-100">
        <span className="inline-flex items-center gap-2 flex-wrap">
          {displayTaskName(r.task)}
          {isHero && (
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 bg-gold/15 text-gold border border-gold/40">
              biggest win
            </span>
          )}
        </span>
      </td>
      <td className="text-right tabular-nums text-zinc-400 whitespace-nowrap">
        {yourPts} → {target}
      </td>
      <td className="text-right tabular-nums">
        <span className="text-emerald-300 font-bold">+{gainPts(r)}</span>
      </td>
      <td className="text-right tabular-nums text-zinc-400 whitespace-nowrap">
        {np.kind === "maxed" ? (
          <span className="text-sky-400 text-xs">maxed</span>
        ) : (
          <>
            {np.drop ? "−" : "+"}
            {formatIdleon(np.cost)} → {formatIdleon(np.target)}
          </>
        )}
      </td>
      <td className="text-center">
        {clsMeta ? (
          <span
            className={`inline-block text-[11px] font-semibold uppercase tracking-wide rounded-md px-2.5 py-1 border ${clsMeta.chip}`}
          >
            {clsMeta.label}
          </span>
        ) : (
          <span className="text-zinc-600 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}
