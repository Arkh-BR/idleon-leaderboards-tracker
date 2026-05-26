"use client";

import { useCallback, useEffect, useState } from "react";
import {
  arcaneFactor,
  buildMapOptions,
  type MapOption,
} from "@/lib/dropRate/arcaneBonus";
import { buildDropRateTree, type TreeNode } from "@/lib/dropRate/treeBuilder";
import { formatIdleon } from "@/lib/format";
import { listCharacters, parseSave, type CharSummary } from "@/lib/dropRate/extract";
import DrTree from "./DrTree";
import CorganTree from "./CorganTree";
import type { CorganNode as DrNode } from "@/lib/corgan/node";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

const SAVE_KEY = "drop-rate-tracker.last-upload.v1";

type ComputeFn = typeof import("@/lib/dropRate/breakdown").computeDropRateBreakdown;

export type CalculatorState = {
  charIndex: number | null;
  charName: string;
  charSummary: CharSummary | null;
  totalDr: number | null;
  baseDr: number | null;
  arcane: number;
  mapIndex: number;
  mapLabel: string;
  rawSaveText: string | null;
  // Full detailed tree so snapshots can capture per-node values for delta
  // comparisons against future saves.
  drTree: DrNode | null;
};

type Props = {
  // Parent passes the latest state back so the snapshot button can grab it.
  onStateChange?: (s: CalculatorState) => void;
  // Optional baseline (from a saved snapshot) — when set, the detailed tree
  // renders a "Δ vs snap" column for every node.
  compareBaseline?: {
    flatTree: FlatTree;
    capturedAt: number;
    charName: string;
  } | null;
};

export default function DrCalculator({ onStateChange, compareBaseline }: Props) {
  const [jsonText, setJsonText] = useState("");
  const [save, setSave] = useState<any | null>(null);
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [mapIdx, setMapIdx] = useState<number>(0);
  const [mapOptions, setMapOptions] = useState<MapOption[]>([
    { index: 0, name: "Town (no AC)", kills: 0, factor: 1, label: "Town (no AC)" },
  ]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [baseDr, setBaseDr] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  // Which breakdown view to display: the detailed pool tree
  // (LUK Scaling → Main Additive → LUK2 Additive → Post-Processing) used as
  // the canonical DR, or the simpler additive/multiplicative panel.
  const [tab, setTab] = useState<"it" | "detailed">("detailed");
  const [drTree, setDrTree] = useState<DrNode | null>(null);
  const [drTotal, setDrTotal] = useState<number | null>(null);

  // Chip Gallery: invisible +0.10 Gallery Bonus Multi when Lab chip 16
  // (Silkrode Motherboard) was active at the moment the gallery refreshed.
  // Auto-detected from Lab[1+ci][s] on save load; user can toggle manually.
  const [chipGalleryActive, setChipGalleryActive] = useState(false);
  const [chipDetected, setChipDetected] = useState<{
    detected: boolean;
    charIdx: number;
    slot: number;
    labSlots?: number[][];
  } | null>(null);

  // Dynamic-imported compute function — keeps the IT pipeline + website-data
  // out of the initial bundle. Loaded on first compute call and cached.
  const [computeFn, setComputeFn] = useState<ComputeFn | null>(null);

  const loadComputeFn = useCallback(async (): Promise<ComputeFn> => {
    if (computeFn) return computeFn;
    const mod = await import("@/lib/dropRate/breakdown");
    setComputeFn(() => mod.computeDropRateBreakdown);
    return mod.computeDropRateBreakdown;
  }, [computeFn]);

  const stageSave = useCallback((text: string, opts: { silent?: boolean } = {}) => {
    try {
      const parsed = parseSave(text);
      const list = listCharacters(parsed);
      if (list.length === 0) {
        if (!opts.silent) setError("Save parsed but no characters found.");
        return false;
      }
      setSave(parsed);
      setChars(list);
      setCharIdx((prev) =>
        list.some((c) => c.charIndex === prev) ? prev : list[0].charIndex
      );
      const opts2 = buildMapOptions(parsed);
      setMapOptions(opts2);
      // Default to character's current map if available, else Town
      const data = (parsed as any)?.data ?? {};
      const currentMap = Number(data[`CurrentMap_${list[0].charIndex}`]) || 0;
      setMapIdx(opts2.some((m) => m.index === currentMap) ? currentMap : 0);
      try {
        window.localStorage.setItem(SAVE_KEY, text);
      } catch {
        // quota exceeded
      }
      setError(null);
      return true;
    } catch (e) {
      if (!opts.silent) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return false;
    }
  }, []);

  // Hydrate on mount from localStorage so refresh doesn't blow away the upload
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) stageSave(raw, { silent: true });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute whenever save/char/map changes
  useEffect(() => {
    if (!save || chars.length === 0) {
      setTree(null);
      setBaseDr(null);
      return;
    }
    let cancelled = false;
    setComputing(true);
    setStatus("Computing breakdown…");
    loadComputeFn()
      .then((compute) => {
        if (cancelled) return;
        const result = compute(save, charIdx);
        const ch = chars.find((c) => c.charIndex === charIdx);
        const charLabel = ch?.charName ?? `Char ${charIdx}`;
        const map = mapOptions.find((m) => m.index === mapIdx);
        const factor = map ? map.factor : arcaneFactor(0);
        const mapLabel = map?.name ?? "Town";
        const base = Number(result.breakdown?.dropRate ?? 0);
        const t = buildDropRateTree(
          result.breakdown?.breakdown as any,
          base,
          factor,
          charLabel,
          mapLabel
        );
        setTree(t);
        setBaseDr(base);
        setStatus(null);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [save, charIdx, mapIdx, chars, mapOptions, loadComputeFn]);

  // Detect Lab chip 16 (Silkrode Motherboard) on save load. Reads
  // Lab[1+ci][s] for every character; if any slot has chip 16 the gallery
  // chip toggle auto-flips ON since the in-game gallery refresh likely
  // captured the +0.10 multi already.
  useEffect(() => {
    if (!save) {
      setChipDetected(null);
      setChipGalleryActive(false);
      return;
    }
    const data = (save as any)?.data ?? save;
    let lab: any = data.Lab;
    if (typeof lab === "string") {
      try {
        lab = JSON.parse(lab);
      } catch {
        lab = null;
      }
    }
    const found: {
      detected: boolean;
      charIdx: number;
      slot: number;
      labSlots: number[][];
    } = { detected: false, charIdx: -1, slot: -1, labSlots: [] };
    if (Array.isArray(lab)) {
      for (let ci = 0; ci < 10; ci++) {
        const slots = lab[1 + ci];
        if (!Array.isArray(slots)) continue;
        found.labSlots.push(slots.map((v) => Number(v) || 0));
        if (found.detected) continue;
        for (let s = 0; s < 7; s++) {
          if (Number(slots[s]) === 16) {
            found.detected = true;
            found.charIdx = ci;
            found.slot = s;
            break;
          }
        }
      }
    }
    setChipDetected(found);
    setChipGalleryActive(found.detected);
  }, [save]);

  // Compute the detailed DR tree whenever save/char/chip changes. Loaded
  // lazily so the initial bundle stays small.
  useEffect(() => {
    if (!save || chars.length === 0) {
      setDrTree(null);
      setDrTotal(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/lib/corgan/computeDR");
        if (cancelled) return;
        const result = mod.computeCorganDropRate(save, charIdx, mapIdx, {
          chipGalleryActive,
        });
        setDrTree(result.tree);
        setDrTotal(result.total);
      } catch (e) {
        if (!cancelled) {
          setError(
            "Drop rate compute failed: " + (e instanceof Error ? e.message : String(e))
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [save, charIdx, mapIdx, chars.length, chipGalleryActive]);

  // Bubble state up to parent (so snapshot section can access it). Uses the
  // detailed compute as the primary base when available; falls back to the
  // IT-style baseDr.
  useEffect(() => {
    if (!onStateChange) return;
    const ch = chars.find((c) => c.charIndex === charIdx);
    const map = mapOptions.find((m) => m.index === mapIdx);
    const factor = map ? map.factor : 1;
    const base = drTotal !== null ? drTotal : baseDr;
    onStateChange({
      charIndex: ch ? ch.charIndex : null,
      charName: ch?.charName ?? "",
      charSummary: ch ?? null,
      totalDr: base !== null ? base * factor : null,
      baseDr: base,
      arcane: factor,
      mapIndex: mapIdx,
      mapLabel: map?.name ?? "Town",
      rawSaveText: save
        ? (typeof window !== "undefined"
            ? window.localStorage.getItem(SAVE_KEY)
            : null)
        : null,
      drTree,
    });
  }, [charIdx, mapIdx, baseDr, drTotal, drTree, chars, mapOptions, save, onStateChange]);

  const onLoad = () => {
    setStatus(null);
    if (!jsonText.trim()) {
      setError("Paste a raw save JSON first.");
      return;
    }
    if (stageSave(jsonText)) setJsonText("");
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => stageSave(String(reader.result ?? ""));
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(f);
  };

  const factor = mapOptions.find((m) => m.index === mapIdx)?.factor ?? 1;
  // Primary displayed DR uses the detailed pool-tree compute (matches in-game
  // to within ~1%). Falls back to the simpler IT-style baseDr if the
  // detailed compute hasn't finished or failed.
  const primaryBase = drTotal !== null ? drTotal : baseDr;
  const totalDr = primaryBase !== null ? primaryBase * factor : null;

  return (
    <div>
      <h1 className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-3xl font-extrabold text-gold">
          🎲 Drop Rate Calculator
        </span>
      </h1>
      <p className="text-center text-xs text-zinc-500 mb-4">
        Auto-computes from save JSON. Select character &amp; map. All processing
        local in your browser.
      </p>

      {/* Import box */}
      <details open className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800">
        <summary className="cursor-pointer font-semibold text-gold select-none">
          📋 Import Save JSON
        </summary>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="Paste your raw IdleonToolbox &lsquo;Copy for Support&rsquo; JSON here..."
          className="w-full h-20 mt-2 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-gold"
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={onLoad}
            className="px-4 py-1.5 text-sm font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
          >
            Load Save
          </button>
          <label className="px-4 py-1.5 text-sm rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 cursor-pointer">
            …or upload file
            <input
              type="file"
              accept="application/json,.json,.txt"
              onChange={onFile}
              className="hidden"
            />
          </label>
          <select
            value={charIdx}
            disabled={chars.length === 0}
            onChange={(e) => setCharIdx(Number(e.target.value))}
            className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-sky-300 disabled:opacity-40"
          >
            {chars.length === 0 ? (
              <option value={0}>-- load save first --</option>
            ) : (
              chars.map((c) => (
                <option key={c.charIndex} value={c.charIndex}>
                  {c.charName} (Lv {c.level})
                </option>
              ))
            )}
          </select>
          <select
            value={mapIdx}
            disabled={chars.length === 0}
            onChange={(e) => setMapIdx(Number(e.target.value))}
            className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-sky-300 disabled:opacity-40"
          >
            {mapOptions.map((m) => (
              <option key={m.index} value={m.index}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-300">{error}</p>
        )}
        {status && (
          <p className="mt-2 text-xs text-emerald-300">{status}</p>
        )}
      </details>

      {/* Big DR card centralizado */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-5 mb-4 text-center">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Total Drop Rate Multiplier
        </div>
        <div className="text-5xl font-extrabold text-gold mt-1 tabular-nums">
          {totalDr !== null ? totalDr.toFixed(2) + "x" : "—"}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {chars.length > 0 ? (
            <>
              Character:{" "}
              <span className="text-zinc-300">
                {chars.find((c) => c.charIndex === charIdx)?.charName ?? "—"}
              </span>{" "}
              • Map:{" "}
              <span className="text-zinc-300">
                {mapOptions.find((m) => m.index === mapIdx)?.name ?? "—"}
              </span>
              {factor > 1.001 && (
                <>
                  {" "}
                  • Arcane:{" "}
                  <span className="text-amber-300">{factor.toFixed(2)}x</span>
                </>
              )}
            </>
          ) : (
            "load a save to begin"
          )}
        </div>
        {primaryBase !== null && factor > 1.001 && (
          <div className="text-xs text-zinc-600 mt-1">
            (base {formatIdleon(primaryBase)}x × {factor.toFixed(2)}x map)
          </div>
        )}
      </div>

      {/* Formula breakdown tree */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-sky-300">
            Formula Breakdown
          </h2>
          <div
            role="tablist"
            className="inline-flex gap-1 p-1 rounded-md bg-zinc-950/60 border border-zinc-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "detailed"}
              onClick={() => setTab("detailed")}
              className={`px-3 py-1 text-xs rounded ${
                tab === "detailed"
                  ? "bg-gold/15 text-gold border border-gold/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Detailed pool tree: LUK Scaling → ×1.4 → Main Additive → LUK2 Additive → Sum/100+1 → Chip Cap-Break → Post-Processing"
            >
              🎲 Detailed
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "it"}
              onClick={() => setTab("it")}
              className={`px-3 py-1 text-xs rounded ${
                tab === "it"
                  ? "bg-gold/15 text-gold border border-gold/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Additive/multiplicative summary panel"
            >
              📊 Summary
            </button>
          </div>
        </div>
        {tab === "detailed" && drTotal !== null && (
          <>
            <div className="mb-3 text-xs text-zinc-500">
              Detailed total:{" "}
              <span className="text-amber-300 font-mono">
                {drTotal.toFixed(3)}x
              </span>{" "}
              — full pool tree, matches in-game values to within ~1%
              (includes the sushi&nbsp;54 +1% Gallery Bonus Multi that older
              compute sites miss).
            </div>

            {/* Chip Gallery toggle */}
            <div className="mb-3 p-2 rounded border border-zinc-800 bg-zinc-950/60 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setChipGalleryActive((v) => !v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                  chipGalleryActive
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                }`}
                title="Adds +0.10 to Gallery Bonus Multi (invisible boost from Silkrode Motherboard chip being active when gallery last refreshed)"
              >
                {chipGalleryActive ? "🔌 Chip Gallery ON" : "⚪ Chip Gallery OFF"}
              </button>
              <div className="text-[11px] text-zinc-500 leading-tight">
                {chipDetected?.detected ? (
                  <>
                    <span className="text-emerald-400">●</span> Chip 16 detected on
                    char {chipDetected.charIdx} slot {chipDetected.slot}{" "}
                    <span className="text-zinc-600">
                      (auto-enabled — toggle off to compare baseline)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-600">○</span> Chip 16 not detected
                    in save — toggle on if it was active when the gallery last
                    refreshed
                    {chipDetected?.labSlots && chipDetected.labSlots.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-zinc-600 hover:text-zinc-400">
                          show lab chip slots ({chipDetected.labSlots.length} chars)
                        </summary>
                        <div className="mt-1 font-mono text-[10px] text-zinc-500 max-h-32 overflow-auto">
                          {chipDetected.labSlots.map((slots, ci) => (
                            <div key={ci}>
                              char {ci}: [{slots.join(", ")}]
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {tab === "detailed" && compareBaseline && (
          <div className="mb-3 text-xs text-sky-300 flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40">
              📐 Comparing vs snapshot
            </span>
            <span className="text-zinc-500">
              {compareBaseline.charName} @{" "}
              {new Date(compareBaseline.capturedAt).toLocaleString()}
            </span>
            <span className="text-zinc-600">
              (delta column appears on every node)
            </span>
          </div>
        )}
        {computing ? (
          <p className="text-sm text-zinc-500 italic">Computing…</p>
        ) : tab === "detailed" ? (
          <CorganTree
            tree={drTree}
            baseline={compareBaseline?.flatTree ?? null}
          />
        ) : (
          <DrTree tree={tree} />
        )}
      </div>
    </div>
  );
}
