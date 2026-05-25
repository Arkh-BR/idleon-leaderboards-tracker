"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSnapshot,
  listCharacters,
  luckDropRateContribution,
  parseSave,
  type CharSummary,
  type DropRateSnapshot,
} from "@/lib/dropRate/extract";
import {
  addSnapshot,
  clearChar,
  deleteSnapshot,
  exportAllAsJson,
  importFromJson,
  listSnapshots,
  listTrackedChars,
} from "@/lib/dropRate/storage";
import { formatIdleon, formatRelativeTime } from "@/lib/format";

const PARSED_KEY = "drop-rate-tracker.last-upload.v1";

export default function DropRatePageClient() {
  const [jsonText, setJsonText] = useState("");
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [selectedCharIdx, setSelectedCharIdx] = useState<number | null>(null);
  const [accountDropRate, setAccountDropRate] = useState<number | null>(null);
  const [saveUpdatedAt, setSaveUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Tracked chars come from localStorage; we re-read after every snapshot
  // op so the picker stays in sync.
  const [trackedChars, setTrackedChars] = useState<string[]>([]);
  const [viewChar, setViewChar] = useState<string | null>(null);
  const [history, setHistory] = useState<DropRateSnapshot[]>([]);

  const refreshTracked = useCallback(() => {
    const list = listTrackedChars();
    setTrackedChars(list);
    setViewChar((prev) => {
      if (prev && list.includes(prev)) return prev;
      return list[0] ?? null;
    });
  }, []);

  useEffect(() => {
    refreshTracked();
  }, [refreshTracked]);

  useEffect(() => {
    if (!viewChar) {
      setHistory([]);
      return;
    }
    setHistory(listSnapshots(viewChar));
  }, [viewChar, trackedChars]);

  // Hydrate the last-uploaded save so the page survives a refresh without
  // forcing the user to re-paste. We only restore the parsed char list, not
  // the (potentially huge) JSON text.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PARSED_KEY);
      if (raw) parseAndStage(raw, { suppressErrors: true });
    } catch {
      // ignore — empty paste state is fine
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseAndStage(
    text: string,
    opts: { suppressErrors?: boolean } = {}
  ): boolean {
    try {
      const save = parseSave(text);
      const list = listCharacters(save);
      if (list.length === 0) {
        if (!opts.suppressErrors) {
          setError("Save parsed but no characters found (missing PVStatList_N).");
        }
        return false;
      }
      setChars(list);
      setSelectedCharIdx((prev) =>
        prev !== null && list.some((c) => c.charIndex === prev) ? prev : list[0].charIndex
      );
      const accountDr =
        (save.extraData &&
          typeof (save.extraData as Record<string, unknown>).dropRate === "number" &&
          ((save.extraData as Record<string, unknown>).dropRate as number)) ||
        null;
      setAccountDropRate(accountDr);
      const updated =
        typeof save.lastUpdated === "number" ? (save.lastUpdated as number) : null;
      setSaveUpdatedAt(updated);
      try {
        window.localStorage.setItem(PARSED_KEY, text);
      } catch {
        // ignore storage failures
      }
      setError(null);
      return true;
    } catch (e) {
      if (!opts.suppressErrors) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return false;
    }
  }

  function onParseClick() {
    setNotice(null);
    if (!jsonText.trim()) {
      setError("Paste a raw save JSON first.");
      return;
    }
    if (parseAndStage(jsonText)) {
      setJsonText("");
    }
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (parseAndStage(text)) {
        setNotice(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }

  function onSaveSnapshot() {
    setError(null);
    setNotice(null);
    if (selectedCharIdx === null) {
      setError("Pick a character first.");
      return;
    }
    try {
      const save = parseSave(window.localStorage.getItem(PARSED_KEY) ?? "");
      const snap = buildSnapshot(save, selectedCharIdx);
      addSnapshot(snap);
      setNotice(
        `Snapshot saved for ${snap.charName} — DR ${formatIdleon(snap.accountDropRate)}x`
      );
      refreshTracked();
      setViewChar(snap.charName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onClearChar(charName: string) {
    if (!confirm(`Erase all snapshots for ${charName}?`)) return;
    clearChar(charName);
    refreshTracked();
    setNotice(`Cleared history for ${charName}.`);
  }

  function onDeleteSnap(charName: string, capturedAt: number) {
    deleteSnapshot(charName, capturedAt);
    setHistory(listSnapshots(charName));
    refreshTracked();
  }

  function onExport() {
    const text = exportAllAsJson();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drop-rate-snapshots-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const res = importFromJson(text);
      if (!res.ok) {
        setError(res.error ?? "Import failed");
        return;
      }
      setNotice(
        `Imported ${res.snapshotsImported} snapshots across ${res.charsImported} characters.`
      );
      refreshTracked();
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }

  const selectedChar = useMemo(
    () => chars.find((c) => c.charIndex === selectedCharIdx) ?? null,
    [chars, selectedCharIdx]
  );

  const luckOnlyDr = useMemo(() => {
    if (!selectedChar) return null;
    // Recreates IT's formula: total DR if luck was the *only* source.
    return 1.4 * (luckDropRateContribution(selectedChar.luck) / 1.4) + 1; // = 1 + luckContribution
  }, [selectedChar]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h1 className="text-2xl font-bold text-gold">Drop Rate Tracker</h1>
          <span
            className="text-[10px] font-bold uppercase tracking-wide bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded px-1.5 py-0.5"
            title="Phase 1: final DR + correlated stats. Full additive/multiplicative breakdown coming in Phase 2."
          >
            Phase 1
          </span>
        </div>
        <p className="text-zinc-400 text-sm">
          Paste a raw save JSON from IdleonToolbox{" "}
          <span className="text-zinc-300">(&ldquo;Copy for Support&rdquo;)</span> and snapshot
          your account-wide Drop Rate over time. History stays in your browser
          via localStorage — nothing leaves your device.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">
          1 — Load save
        </h2>
        <div className="flex flex-col gap-3">
          <textarea
            className="w-full min-h-[120px] rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 focus:border-gold/60 focus:outline-none"
            placeholder='Paste the raw JSON from IdleonToolbox "Copy for Support" here…'
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={onParseClick}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25"
            >
              Parse pasted JSON
            </button>
            <label className="px-4 py-1.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 cursor-pointer">
              …or upload .json file
              <input
                type="file"
                accept="application/json,.json,.txt"
                onChange={onFileUpload}
                className="hidden"
              />
            </label>
            {chars.length > 0 && (
              <span className="text-xs text-zinc-500">
                {chars.length} character{chars.length === 1 ? "" : "s"} loaded
                {saveUpdatedAt
                  ? ` — save from ${new Date(saveUpdatedAt).toLocaleString()}`
                  : ""}
              </span>
            )}
          </div>
        </div>
      </section>

      {chars.length > 0 && (
        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">
            2 — Snapshot a character
          </h2>
          {accountDropRate !== null && (
            <div className="mb-3 text-xs text-zinc-400">
              Account-wide DR (from <code className="text-zinc-300">extraData.dropRate</code>):{" "}
              <span className="text-gold font-semibold text-sm">
                {formatIdleon(accountDropRate)}x
              </span>{" "}
              — this is the highest single value the game tracks; the same
              number is recorded for whichever character you snapshot.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2">Char</th>
                  <th className="px-2 py-2 text-right">Level</th>
                  <th className="px-2 py-2 text-right">Luck</th>
                  <th className="px-2 py-2 text-right">DR from Luck alone</th>
                  <th className="px-2 py-2 text-right">STR / AGI / WIS</th>
                </tr>
              </thead>
              <tbody>
                {chars.map((c) => {
                  const luckOnly = 1 + luckDropRateContribution(c.luck);
                  const isSelected = c.charIndex === selectedCharIdx;
                  return (
                    <tr
                      key={c.charIndex}
                      onClick={() => setSelectedCharIdx(c.charIndex)}
                      className={`cursor-pointer border-b border-zinc-900 ${
                        isSelected ? "bg-gold/10" : "hover:bg-zinc-800/40"
                      }`}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="radio"
                          name="char"
                          checked={isSelected}
                          onChange={() => setSelectedCharIdx(c.charIndex)}
                          className="accent-gold"
                        />
                      </td>
                      <td className="px-2 py-2 font-medium text-zinc-200">
                        {c.charName}
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-300">{c.level}</td>
                      <td className="px-2 py-2 text-right text-zinc-200 font-mono">
                        {formatIdleon(c.luck)}
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-400 font-mono">
                        {luckOnly.toFixed(3)}x
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-zinc-500 font-mono">
                        {formatIdleon(c.strength)} / {formatIdleon(c.agility)} /{" "}
                        {formatIdleon(c.wisdom)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <button
              type="button"
              onClick={onSaveSnapshot}
              disabled={selectedCharIdx === null}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              💾 Save snapshot for {selectedChar?.charName ?? "…"}
            </button>
            {selectedChar && luckOnlyDr !== null && (
              <span className="text-xs text-zinc-500">
                Luck contributes {((luckOnlyDr - 1) * 100).toFixed(1)}% of the
                base DR formula
              </span>
            )}
          </div>
        </section>
      )}

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            3 — History
          </h2>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={onExport}
              className="px-3 py-1 text-xs rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
            >
              ⬇ Export JSON
            </button>
            <label className="px-3 py-1 text-xs rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 cursor-pointer">
              ⬆ Import
              <input
                type="file"
                accept="application/json,.json"
                onChange={onImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {trackedChars.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">
            No snapshots yet. Load a save above and click &ldquo;Save snapshot&rdquo;
            to start tracking.
          </p>
        ) : (
          <>
            <div className="flex gap-1 mb-3 flex-wrap">
              {trackedChars.map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => setViewChar(name)}
                  className={`px-3 py-1 text-xs rounded-md border ${
                    viewChar === name
                      ? "bg-gold/15 text-gold border-gold/40"
                      : "bg-zinc-800/40 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  {name}{" "}
                  <span className="opacity-60">
                    ({listSnapshots(name).length})
                  </span>
                </button>
              ))}
              {viewChar && (
                <button
                  type="button"
                  onClick={() => onClearChar(viewChar)}
                  className="ml-auto px-3 py-1 text-xs rounded-md bg-red-500/10 text-red-300 border border-red-500/40 hover:bg-red-500/20"
                >
                  🗑 Clear {viewChar}
                </button>
              )}
            </div>

            {viewChar && history.length > 0 ? (
              <>
                <DropRateChart history={history} />
                <HistoryTable
                  history={history}
                  onDelete={(ts) => onDeleteSnap(viewChar, ts)}
                />
              </>
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No snapshots for {viewChar} yet.
              </p>
            )}
          </>
        )}
      </section>

      <footer className="mt-12 text-xs text-zinc-600 text-center border-t border-zinc-900 pt-4">
        Phase 1 MVP — final DR sourced from{" "}
        <code className="text-zinc-500">extraData.dropRate</code> in IT&rsquo;s
        envelope. Phase 2 will add the full additive/multiplicative breakdown
        (~45 sources) ported from{" "}
        <code className="text-zinc-500">parsers/character.ts:getDropRate</code>.
      </footer>
    </main>
  );
}

function DropRateChart({ history }: { history: DropRateSnapshot[] }) {
  const points = history
    .map((s) => ({ x: s.capturedAt, y: s.accountDropRate ?? 0 }))
    .filter((p) => p.y > 0);
  if (points.length < 2) {
    return (
      <div className="text-xs text-zinc-500 italic mb-4">
        Need at least 2 snapshots to draw a trend line.
      </div>
    );
  }
  const W = 900;
  const H = 180;
  const padL = 60;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const sx = (x: number) => padL + ((x - minX) / spanX) * (W - padL - padR);
  const sy = (y: number) =>
    H - padB - ((y - minY) / spanY) * (H - padT - padB);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    .join(" ");
  return (
    <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        <line
          x1={padL}
          x2={W - padR}
          y1={H - padB}
          y2={H - padB}
          stroke="#3f3f46"
          strokeWidth={1}
        />
        <line
          x1={padL}
          x2={padL}
          y1={padT}
          y2={H - padB}
          stroke="#3f3f46"
          strokeWidth={1}
        />
        <text
          x={padL}
          y={padT + 4}
          textAnchor="end"
          className="fill-zinc-500"
          fontSize={10}
        >
          {formatIdleon(maxY)}x
        </text>
        <text
          x={padL}
          y={H - padB}
          textAnchor="end"
          className="fill-zinc-500"
          fontSize={10}
        >
          {formatIdleon(minY)}x
        </text>
        <path d={path} fill="none" stroke="#FFD700" strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={2.5}
            fill="#FFD700"
            stroke="#000"
            strokeWidth={0.5}
          >
            <title>
              {new Date(p.x).toLocaleString()} — {formatIdleon(p.y)}x
            </title>
          </circle>
        ))}
        <text
          x={padL}
          y={H - 8}
          className="fill-zinc-500"
          fontSize={10}
        >
          {new Date(minX).toLocaleDateString()}
        </text>
        <text
          x={W - padR}
          y={H - 8}
          textAnchor="end"
          className="fill-zinc-500"
          fontSize={10}
        >
          {new Date(maxX).toLocaleDateString()}
        </text>
      </svg>
    </div>
  );
}

function HistoryTable({
  history,
  onDelete,
}: {
  history: DropRateSnapshot[];
  onDelete: (capturedAt: number) => void;
}) {
  // Newest first in the table — easier to scan recent progress
  const rows = [...history].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
            <th className="px-2 py-2">Captured</th>
            <th className="px-2 py-2 text-right">DR</th>
            <th className="px-2 py-2 text-right">Δ DR</th>
            <th className="px-2 py-2 text-right">Luck</th>
            <th className="px-2 py-2 text-right">Level</th>
            <th className="px-2 py-2 text-right">Cash Multi</th>
            <th className="px-2 py-2 text-right">World</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const prev = rows[i + 1]; // older one (since reversed)
            const dr = s.accountDropRate ?? 0;
            const prevDr = prev?.accountDropRate ?? null;
            const deltaDr = prevDr !== null ? dr - prevDr : null;
            return (
              <tr key={s.capturedAt} className="border-b border-zinc-900">
                <td className="px-2 py-2 text-zinc-300">
                  <div>{new Date(s.capturedAt).toLocaleString()}</div>
                  <div className="text-[10px] text-zinc-500">
                    {formatRelativeTime(s.capturedAt)}
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-mono text-gold">
                  {formatIdleon(dr)}x
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {deltaDr === null ? (
                    <span className="text-zinc-600">—</span>
                  ) : deltaDr > 0 ? (
                    <span className="text-emerald-400">
                      +{formatIdleon(deltaDr)}x
                    </span>
                  ) : deltaDr < 0 ? (
                    <span className="text-red-400">
                      {formatIdleon(deltaDr)}x
                    </span>
                  ) : (
                    <span className="text-zinc-500">0</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-mono text-zinc-300">
                  {formatIdleon(s.luck)}
                </td>
                <td className="px-2 py-2 text-right text-zinc-400">{s.level}</td>
                <td className="px-2 py-2 text-right font-mono text-zinc-400">
                  {formatIdleon(s.accountCashMulti)}x
                </td>
                <td className="px-2 py-2 text-right text-zinc-400">
                  {s.accountCurrentWorld ?? "—"}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(s.capturedAt)}
                    className="text-zinc-500 hover:text-red-300 text-xs"
                    title="Delete this snapshot"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
