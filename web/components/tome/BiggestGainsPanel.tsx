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

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { CLASSIFICATION_STYLE } from "./BestTomePanel";
import { formatIdleon } from "@/lib/format";

const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const CLASSIFICATIONS_KEY = "idleon-leaderboards.tome.userClassifications";

// The "Class" column reuses the editable-chip palette the Best Tome panel owns
// (CLASSIFICATION_STYLE). Importing it instead of duplicating a local map keeps
// the same data the same color across both tabs and avoids drift (UI spec §2.6).

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
  "Calculate Tome, this view auto-populates.";

// Edge copy (English) — see the design spec §4.
// NOTE: this one message intentionally merges two §4 edge states that share the
// exact same trigger (ranked is empty while gated gaps remain): "only gated
// left" and "you've matched the top on every pushable task". Both mean the same
// thing to the player — no actionable move right now, more behind the gated
// toggle — so we state that result once and point at the toggle.
const NO_ACTIONABLE =
  "No actionable gains right now — your remaining gaps are time/luck/update " +
  "gated. Toggle 'Include gated tasks' to see them.";
const AT_CEILING =
  "You're at or above the top observed players on every task — nothing to gain " +
  "here. Nice.";

// Edge-state helpers mirror the Drop Rate precedent (dropRate/BiggestGains.tsx
// :41-51) so both prescriptive tabs render empty/error states identically.
function Banner({ children }: { children: ReactNode }) {
  return <p className="text-sm text-red-400 py-4">⚠ {children}</p>;
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-500 text-center py-10">{children}</p>;
}

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
    return <Banner>Error: {error}</Banner>;
  }

  if (!result) {
    return <Hint>{EMPTY_HINT}</Hint>;
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
            className="accent-emerald-500"
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
          <span aria-hidden="true">🏰</span> Dungeon = 1{dungeonAsOne ? " ✓" : ""}
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
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
      <span aria-hidden="true">💡</span> <strong>Biggest win →</strong> push{" "}
      <strong>{displayTaskName(hero.task)}</strong> for{" "}
      <strong className="tabular-nums">+{gainPts(hero)} Tome pts</strong>
      <div className="text-xs text-emerald-200/70 mt-0.5 tabular-nums">{next}</div>
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
        <thead className="text-zinc-400">
          <tr className="[&>th]:bg-zinc-900 [&>th]:border-b [&>th]:border-zinc-800 [&>th]:px-3 [&>th]:py-2">
            <th scope="col" className="text-left">Task</th>
            <th scope="col" className="text-right whitespace-nowrap">You → Top</th>
            <th scope="col" className="text-right whitespace-nowrap">Tome pts gain</th>
            <th scope="col" className="text-right whitespace-nowrap">Next point</th>
            <th scope="col" className="text-center">Class</th>
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
  const clsMeta = cls !== null ? CLASSIFICATION_STYLE[cls] : null;

  return (
    <tr
      className={`[&>td]:border-b [&>td]:border-zinc-800/60 [&>td]:px-3 [&>td]:py-2.5 hover:bg-zinc-900/40 ${
        isHero ? "bg-emerald-500/5" : ""
      }`}
    >
      <td className="font-medium text-zinc-100">
        <span className="inline-flex items-center gap-2 flex-wrap">
          {displayTaskName(r.task)}
          {isHero && (
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              biggest win
            </span>
          )}
        </span>
      </td>
      <td className="text-right tabular-nums text-zinc-400 whitespace-nowrap">
        {yourPts} → {target}
      </td>
      <td className="text-right tabular-nums">
        <span className="text-emerald-300 font-semibold">+{gainPts(r)}</span>
      </td>
      <td className="text-right tabular-nums text-zinc-400 whitespace-nowrap">
        {np.kind === "maxed" ? (
          <span className="text-zinc-500 text-xs">maxed</span>
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
