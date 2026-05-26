"use client";

import { useCallback, useEffect, useState } from "react";
import { buildSnapshot, parseSave, type DropRateSnapshot } from "@/lib/dropRate/extract";
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
import { flattenTree, type FlatTree } from "@/lib/dropRate/treeFlatten";
import type { CalculatorState } from "./DrCalculator";

// Augment the legacy DropRateSnapshot with the freshly-computed total DR
// from the calculator section so the history reflects the real getDropRate
// number (not the misleading extraData.dropRate captured by Phase 1). Also
// includes the flattened detailed tree so we can show a per-node delta
// column against any prior snapshot.
type EnrichedSnapshot = DropRateSnapshot & {
  computedDropRate?: number;
  arcaneFactor?: number;
  mapName?: string;
  /** Path → value for every node in the detailed pool tree (since v2). */
  flatTree?: FlatTree;
};

const STORAGE_KEY = "drop-rate-tracker.v1"; // matches storage.ts

type Props = {
  state: CalculatorState | null;
  /** Tells the parent which snapshot's flatTree to use as the delta
   *  baseline in the detailed tree's third column. Null = no comparison. */
  onSelectBaseline?: (baseline: {
    flatTree: FlatTree;
    capturedAt: number;
    charName: string;
  } | null) => void;
  /** Which snapshot's `capturedAt` is currently selected as the baseline.
   *  Used so the row that's been picked stays visually highlighted. */
  selectedBaselineAt?: number | null;
};

const COLLAPSE_KEY = "drop-rate.snapshot-section.collapsed.v1";

export default function SnapshotSection({
  state,
  onSelectBaseline,
  selectedBaselineAt,
}: Props) {
  const [trackedChars, setTrackedChars] = useState<string[]>([]);
  const [viewChar, setViewChar] = useState<string | null>(null);
  const [history, setHistory] = useState<EnrichedSnapshot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Whole-section collapse — defaults to expanded for first-time users and
  // is persisted to localStorage so the choice survives reloads.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem(COLLAPSE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const refresh = useCallback(() => {
    const list = listTrackedChars();
    setTrackedChars(list);
    setViewChar((prev) => (prev && list.includes(prev) ? prev : list[0] ?? null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!viewChar) {
      setHistory([]);
      return;
    }
    setHistory(listSnapshots(viewChar) as EnrichedSnapshot[]);
  }, [viewChar, trackedChars]);

  const canSave =
    !!state &&
    state.charIndex !== null &&
    state.totalDr !== null &&
    state.rawSaveText !== null;

  function onSave() {
    if (!canSave || !state || !state.rawSaveText) return;
    try {
      const save = parseSave(state.rawSaveText);
      const baseSnap = buildSnapshot(save, state.charIndex!);
      const flat = flattenTree(state.drTree);
      const nodeCount = Object.keys(flat).length;
      const enriched: EnrichedSnapshot = {
        ...baseSnap,
        computedDropRate: state.totalDr ?? undefined,
        arcaneFactor: state.arcane,
        mapName: state.mapLabel,
        flatTree: nodeCount > 0 ? flat : undefined,
      };
      addSnapshot(enriched);
      setNotice(
        `Snapshot saved for ${baseSnap.charName} — DR ${formatIdleon(
          state.totalDr ?? 0
        )}x on ${state.mapLabel}${
          nodeCount > 0 ? ` (${nodeCount} tree nodes captured)` : ""
        }`
      );
      refresh();
      setViewChar(baseSnap.charName);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }

  /** Toggle this snapshot as the delta baseline for the detailed tree.
   *  Click again to clear. Re-selecting a different snap swaps the baseline. */
  function onPickBaseline(snap: EnrichedSnapshot) {
    if (!onSelectBaseline) return;
    if (selectedBaselineAt === snap.capturedAt) {
      onSelectBaseline(null);
      return;
    }
    if (!snap.flatTree) {
      setNotice(
        "This snapshot doesn't have a tree captured (saved before v2). Save a new one to compare against."
      );
      return;
    }
    onSelectBaseline({
      flatTree: snap.flatTree,
      capturedAt: snap.capturedAt,
      charName: snap.charName,
    });
  }

  function onClear(charName: string) {
    if (!confirm(`Erase all snapshots for ${charName}?`)) return;
    clearChar(charName);
    refresh();
  }

  function onDel(charName: string, ts: number) {
    deleteSnapshot(charName, ts);
    setHistory(listSnapshots(charName) as EnrichedSnapshot[]);
    refresh();
  }

  function onExport() {
    const text = exportAllAsJson();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drop-rate-snapshots-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importFromJson(String(reader.result ?? ""));
      setNotice(
        res.ok
          ? `Imported ${res.snapshotsImported} snapshots across ${res.charsImported} chars.`
          : res.error ?? "Import failed"
      );
      refresh();
    };
    reader.readAsText(f);
  }

  // Aggregate count across all tracked chars so the collapsed header can
  // surface "47 snapshots across 3 chars" without expanding.
  const totalSnaps = trackedChars.reduce(
    (a, n) => a + listSnapshots(n).length,
    0
  );

  return (
    <section className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Header doubles as the collapse toggle so the user can hide the
            whole capture history when they don't need it. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-base font-semibold text-sky-300 hover:text-sky-200 select-none"
          title={collapsed ? "Expand snapshot history" : "Collapse snapshot history"}
        >
          <span className="w-3 text-zinc-500 select-none">
            {collapsed ? "▸" : "▾"}
          </span>
          <span>📈 Snapshot History</span>
          {collapsed && totalSnaps > 0 && (
            <span className="text-xs text-zinc-500 font-normal">
              ({totalSnaps} capture{totalSnaps === 1 ? "" : "s"} across{" "}
              {trackedChars.length} char{trackedChars.length === 1 ? "" : "s"})
            </span>
          )}
        </button>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="px-3 py-1.5 text-xs rounded bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            💾 Save snapshot
          </button>
          {/* Use the same thin arrows the DeepView Expand/Collapse buttons use
              so the iconography is consistent across the page. Convention:
              ↑ Export — data going OUT of the app (up/out to a file)
              ↓ Import — data coming IN to the app (down/in from a file) */}
          <button
            type="button"
            onClick={onExport}
            className="px-3 py-1 text-xs rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
            title="Export all snapshots to a JSON file"
          >
            ↑ Export
          </button>
          <label
            className="px-3 py-1 text-xs rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 cursor-pointer"
            title="Import snapshots from a previously-exported JSON file"
          >
            ↓ Import
            <input
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
      {!collapsed && (
        <div className="mt-3">
          {notice && (
            <p className="mb-3 text-xs text-emerald-300">{notice}</p>
          )}

          {trackedChars.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">
              No snapshots yet. Click &ldquo;Save snapshot&rdquo; above after loading a
              save.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 mb-3">
                {trackedChars.map((n) => (
                  <button
                    key={n}
                    onClick={() => setViewChar(n)}
                    className={`px-3 py-1 text-xs rounded border ${
                      viewChar === n
                        ? "bg-gold/15 text-gold border-gold/40"
                        : "bg-zinc-800/40 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    {n}{" "}
                    <span className="opacity-60">
                      ({listSnapshots(n).length})
                    </span>
                  </button>
                ))}
                {viewChar && (
                  <button
                    onClick={() => onClear(viewChar)}
                    className="ml-auto px-3 py-1 text-xs rounded bg-red-500/10 text-red-300 border border-red-500/40 hover:bg-red-500/20"
                  >
                    🗑 Clear {viewChar}
                  </button>
                )}
              </div>

              {viewChar && history.length > 0 ? (
                <HistoryTable
                  history={history}
                  onDelete={(t) => onDel(viewChar, t)}
                  onPickBaseline={onPickBaseline}
                  selectedBaselineAt={selectedBaselineAt ?? null}
                />
              ) : (
                <p className="text-sm text-zinc-500 italic">
                  No snapshots for {viewChar} yet.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function HistoryTable({
  history,
  onDelete,
  onPickBaseline,
  selectedBaselineAt,
}: {
  history: EnrichedSnapshot[];
  onDelete: (ts: number) => void;
  onPickBaseline: (snap: EnrichedSnapshot) => void;
  selectedBaselineAt: number | null;
}) {
  const rows = [...history].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
            <th className="px-2 py-2">Captured</th>
            <th className="px-2 py-2 text-right">DR (computed)</th>
            <th className="px-2 py-2 text-right">Δ</th>
            <th className="px-2 py-2 text-right">Luck</th>
            <th className="px-2 py-2 text-right">Map</th>
            <th className="px-2 py-2 text-center">Compare</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const prev = rows[i + 1];
            const dr = s.computedDropRate ?? null;
            const prevDr = prev?.computedDropRate ?? null;
            const delta = dr !== null && prevDr !== null ? dr - prevDr : null;
            const isSelected = selectedBaselineAt === s.capturedAt;
            const hasTree = !!s.flatTree;
            return (
              <tr
                key={s.capturedAt}
                className={`border-b border-zinc-900 ${
                  isSelected ? "bg-sky-500/10" : ""
                }`}
              >
                <td className="px-2 py-2 text-zinc-300">
                  <div>{new Date(s.capturedAt).toLocaleString()}</div>
                  <div className="text-[10px] text-zinc-500">
                    {formatRelativeTime(s.capturedAt)}
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-mono text-gold">
                  {dr !== null ? dr.toFixed(2) + "x" : "—"}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {delta === null ? (
                    <span className="text-zinc-600">—</span>
                  ) : delta > 0 ? (
                    <span className="text-emerald-400">
                      +{delta.toFixed(2)}x
                    </span>
                  ) : delta < 0 ? (
                    <span className="text-red-400">{delta.toFixed(2)}x</span>
                  ) : (
                    <span className="text-zinc-500">0</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-mono text-zinc-300">
                  {formatIdleon(s.luck)}
                </td>
                <td className="px-2 py-2 text-right text-zinc-400 text-xs">
                  {s.mapName ?? "—"}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => onPickBaseline(s)}
                    disabled={!hasTree}
                    title={
                      hasTree
                        ? "Compare current load vs this snapshot in the detailed tree"
                        : "Saved before tree-snapshot support — re-save to compare"
                    }
                    className={`px-2 py-0.5 text-[10px] rounded border ${
                      isSelected
                        ? "bg-sky-500/30 text-sky-200 border-sky-400"
                        : hasTree
                        ? "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                        : "bg-zinc-900 text-zinc-700 border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    {isSelected ? "✓ Active" : "▶ Compare"}
                  </button>
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => onDelete(s.capturedAt)}
                    className="text-zinc-500 hover:text-red-300 text-xs"
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
