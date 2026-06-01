"use client";

import { useEffect, useMemo, useState } from "react";
import { computeTome, type TomeResult, type TomeRow } from "@/lib/tome/compute";
import { formatIdleon } from "@/lib/format";
import ProfileNameLoader from "@/components/ProfileNameLoader";

const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const NAME_KEY = "idleon-leaderboards.tome.playerName";

// Debug panel for validating the tome computation. Shows every task with
// raw value, computed pts, source label, and the [x1, x2, x3] bonus tuple
// so it's possible to verify against the .gs script line-by-line.
export default function TomeRawPanel({
  dungeonAsOne,
  onToggleDungeon,
}: {
  /** Shared "count Dungeon Rank as 1" toggle, owned by the page so it
   *  persists across tab switches / reloads. */
  dungeonAsOne: boolean;
  onToggleDungeon: () => void;
}) {
  const [json, setJson] = useState("");
  // The last-loaded save (raw JSON string or parsed envelope). The displayed
  // result is derived from this + the Dungeon-as-1 toggle, so flipping the
  // toggle re-scores without needing to reload the save.
  const [source, setSource] = useState<
    string | Record<string, unknown> | null
  >(null);
  const [result, setResult] = useState<TomeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Hydrate the COMPUTED result from localStorage on mount, but leave the
  // textarea empty so the user can paste new data without first clearing
  // the old paste. The previous JSON is still in storage (so Best Tome can
  // also hydrate) — it just doesn't get rehydrated into the input.
  useEffect(() => {
    try {
      // If a player name is remembered, ProfileNameLoader auto-fetches it.
      if (localStorage.getItem(NAME_KEY)) return;
      const saved = localStorage.getItem(STORAGE_KEY) || "";
      if (saved) setSource(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Re-score whenever the loaded save or the Dungeon-as-1 toggle changes.
  useEffect(() => {
    if (source == null) {
      setResult(null);
      return;
    }
    try {
      setResult(
        computeTome(source as Parameters<typeof computeTome>[0], {
          dungeonRankAsOne: dungeonAsOne,
        })
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  }, [source, dungeonAsOne]);

  // Load-by-name path: computeTome accepts the parsed object directly. Persist
  // the JSON to STORAGE_KEY so the Best Tome panel (which reads the same key)
  // sees it too; the player name is persisted by ProfileNameLoader.
  function loadFromSave(save: any) {
    setError(null);
    setSource(save); // the effect re-scores (applying the Dungeon-as-1 toggle)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // quota exceeded — non-fatal
    }
  }

  function calculate() {
    setError(null);
    try {
      // Validate the paste up-front so we don't persist garbage; the effect
      // does the real (toggle-aware) scoring once `source` is set.
      computeTome(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
      return;
    }
    setSource(json);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
    // Clear the textarea after a successful calc so the next paste lands
    // on an empty input — no manual select-all/delete required.
    setJson("");
  }

  function clearAll() {
    setJson("");
    setSource(null);
    setResult(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    if (!q) return result.rows;
    return result.rows.filter(
      (r) =>
        r.task.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        String(r.idx) === q ||
        String(r.computeIdx) === q
    );
  }, [result, search]);

  return (
    <div className="space-y-4">
      {/* Primary: load by player name; manual paste lives inside the card. */}
      <ProfileNameLoader
        storageKey={NAME_KEY}
        onSave={loadFromSave}
        onError={(msg) => setError(msg)}
        rightSlot={
          <button
            type="button"
            onClick={onToggleDungeon}
            aria-pressed={dungeonAsOne}
            title="Score the Dungeon Rank tome line as 1 — ignores dungeon progress in the total."
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold rounded border transition-colors ${
              dungeonAsOne
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
            }`}
          >
            🏰 Dungeon = 1{dungeonAsOne ? " ✓" : ""}
          </button>
        }
      >
        {/* Manual paste — fallback for private profiles, inside the card. */}
        <details className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-3 space-y-4">
        <summary className="cursor-pointer select-none flex items-center gap-2 font-semibold text-gold text-sm">
          <span className="dt-arrow text-zinc-500">▸</span>
          📋 Or paste the save manually
        </summary>
      <div className="rounded-lg border border-gold/50 bg-gold/10 p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">📋</span>
          <div className="flex-1 space-y-2">
            <div className="font-semibold text-gold uppercase tracking-wide text-[13px]">
              Use the &ldquo;Copy for Support&rdquo; button
            </div>
            <p className="text-zinc-200 leading-relaxed">
              On{" "}
              <a
                href="https://idleontoolbox.com"
                target="_blank"
                rel="noreferrer"
                className="text-gold hover:underline font-medium"
              >
                idleontoolbox.com
              </a>
              , open your account menu (top-right) and click{" "}
              <strong className="text-gold">&ldquo;Copy for Support&rdquo;</strong>.
              That option includes the parsed tome values, giving us a{" "}
              <strong>guaranteed 118/118 exact match</strong> with IT&rsquo;s
              numbers. Then paste below.
            </p>
            <p className="text-xs text-zinc-400">
              The plain &ldquo;Copy raw data&rdquo; works too (~99.99%
              accuracy), but Star Talents Owned may drift by a few points.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-sm text-zinc-400 font-medium">
            Raw save JSON from idleontoolbox.com
          </label>
          <span className="text-xs text-zinc-600">
            {json.length > 0 ? `${json.length.toLocaleString()} chars` : "empty"}
          </span>
        </div>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='Paste the output of "Copy for Support" here (Ctrl+V)…'
          className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs font-mono text-zinc-300"
          spellCheck={false}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={calculate}
            disabled={!json.trim()}
            className="bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            Calculate Tome
          </button>
          {(json || result) && (
            <button
              onClick={clearAll}
              className="border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          JSON stays in your browser (localStorage). Nothing is sent to any
          server.
        </p>
      </div>
      </details>
      </ProfileNameLoader>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded p-3 text-sm">
          <strong className="text-red-400">Error:</strong> {error}
        </div>
      )}

      {result?.usedParsedTomePoints && (
        <div className="bg-blue-950/40 border border-blue-800/50 rounded p-2 text-xs text-blue-300">
          ✓ Input includes <code className="font-mono">parsedData.tomePoints</code> from
          the IT API — pts column shows IT&rsquo;s authoritative values (marked
          <span className="font-mono"> [IT]</span> in Source).
        </div>
      )}

      {result && <ResultView result={result} filteredRows={filteredRows} search={search} setSearch={setSearch} />}
    </div>
  );
}

function ResultView({
  result,
  filteredRows,
  search,
  setSearch,
}: {
  result: TomeResult;
  filteredRows: TomeRow[];
  search: string;
  setSearch: (s: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Total points" value={result.totalPts.toLocaleString()} accent="gold" />
        <Stat
          label="Covered"
          value={`${result.coveredCount} / ${result.rows.length}`}
          accent="green"
        />
        <Stat label="Missing" value={String(result.missingCount)} accent={result.missingCount > 0 ? "red" : "zinc"} />
        <Stat
          label="Coverage"
          value={`${((result.coveredCount / result.rows.length) * 100).toFixed(1)}%`}
          accent="blue"
        />
      </div>

      <input
        type="text"
        placeholder="Filter tasks (name, source, idx, compute idx)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-2 py-2 text-center w-10">#</th>
              <th className="px-3 py-2 text-left">Tome Task</th>
              <th className="px-3 py-2 text-right w-32">Raw Value</th>
              <th className="px-3 py-2 text-right w-20">Pts</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-2 py-2 text-center w-14">ci</th>
              <th className="px-3 py-2 text-center w-32">Bonus [x1, x2, x3]</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <TomeRowView key={r.idx} row={r} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-zinc-600">
        Showing {filteredRows.length} of {result.rows.length} tasks.
      </div>
    </>
  );
}

// Strips the trailing "(in Seconds)" annotation that the IT data carries on
// fastest-time tasks. Same helper as BestTomePanel — kept inline to avoid a
// shared module for a one-liner.
function displayTaskName(name: string): string {
  return name.replace(/\s*\(in Seconds\)$/i, "");
}

function TomeRowView({ row: r }: { row: TomeRow }) {
  const isMissing = r.pts === null;
  const isLbFallback = r.source.startsWith("MISSING (LB:");
  const isError = r.source.startsWith("ERR");
  let sourceClass = "text-green-400 bg-green-950/30";
  if (isMissing) sourceClass = "text-red-300 bg-red-950/40";
  else if (isLbFallback) sourceClass = "text-blue-300 bg-blue-950/30";
  else if (isError) sourceClass = "text-yellow-300 bg-yellow-950/30";

  return (
    <tr className="border-t border-zinc-800 hover:bg-zinc-900/40">
      <td className="px-2 py-1.5 text-center text-zinc-500 tabular-nums">{r.idx}</td>
      <td className="px-3 py-1.5 font-medium">{displayTaskName(r.task)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-zinc-300">
        {r.rawValue === null ? <span className="text-zinc-600">—</span> : formatIdleon(r.rawValue)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
        {r.pts === null ? (
          <span className="text-zinc-600">—</span>
        ) : (
          <span className={r.pts === 0 ? "text-zinc-500" : "text-gold"}>{r.pts}</span>
        )}
      </td>
      <td className={`px-3 py-1.5 text-xs font-mono ${sourceClass}`}>{r.source}</td>
      <td className="px-2 py-1.5 text-center text-zinc-600 tabular-nums text-xs">{r.computeIdx}</td>
      <td className="px-3 py-1.5 text-center text-xs text-zinc-500 tabular-nums">
        {r.bonus ? `[${r.bonus[0]}, ${r.bonus[1]}, ${r.bonus[2]}]` : "—"}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "green" | "red" | "blue" | "zinc";
}) {
  const colors: Record<typeof accent, string> = {
    gold: "text-gold border-gold/30",
    green: "text-green-400 border-green-700/40",
    red: "text-red-400 border-red-800/40",
    blue: "text-blue-400 border-blue-800/40",
    zinc: "text-zinc-300 border-zinc-700",
  };
  return (
    <div className={`rounded border p-3 bg-zinc-900/40 ${colors[accent]}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
