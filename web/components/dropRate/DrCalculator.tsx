"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { CorganNode } from "@/lib/corgan/node";

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
};

type Props = {
  // Parent passes the latest state back so the snapshot button can grab it.
  onStateChange?: (s: CalculatorState) => void;
};

export default function DrCalculator({ onStateChange }: Props) {
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

  // Which tree to display: the IT-style additive/multiplicative panel
  // (validated against IT's live UI) or the Corgan-style pool tree
  // (LUK Scaling → Main Additive → LUK2 Additive → Post-Processing).
  const [tab, setTab] = useState<"it" | "corgan">("corgan");
  const [corganTree, setCorganTree] = useState<CorganNode | null>(null);
  const [corganTotal, setCorganTotal] = useState<number | null>(null);

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

  // Compute the Corgan-style tree whenever save/char changes. Loads the
  // Corgan port lazily so the initial bundle stays small.
  useEffect(() => {
    if (!save || chars.length === 0) {
      setCorganTree(null);
      setCorganTotal(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/lib/corgan/computeDR");
        if (cancelled) return;
        const result = mod.computeCorganDropRate(save, charIdx, mapIdx);
        setCorganTree(result.tree);
        setCorganTotal(result.total);
      } catch (e) {
        if (!cancelled) {
          setError(
            "Corgan compute failed: " + (e instanceof Error ? e.message : String(e))
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [save, charIdx, mapIdx, chars.length]);

  // Bubble state up to parent (so snapshot section can access it)
  useEffect(() => {
    if (!onStateChange) return;
    const ch = chars.find((c) => c.charIndex === charIdx);
    const map = mapOptions.find((m) => m.index === mapIdx);
    const factor = map ? map.factor : 1;
    onStateChange({
      charIndex: ch ? ch.charIndex : null,
      charName: ch?.charName ?? "",
      charSummary: ch ?? null,
      totalDr: baseDr !== null ? baseDr * factor : null,
      baseDr,
      arcane: factor,
      mapIndex: mapIdx,
      mapLabel: map?.name ?? "Town",
      rawSaveText: save
        ? (typeof window !== "undefined"
            ? window.localStorage.getItem(SAVE_KEY)
            : null)
        : null,
    });
  }, [charIdx, mapIdx, baseDr, chars, mapOptions, save, onStateChange]);

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
  const totalDr = baseDr !== null ? baseDr * factor : null;

  return (
    <div>
      {/* Header inline — mirrors Corgan layout */}
      <h1 className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-3xl font-extrabold text-gold">
          🎲 Drop Rate Calculator
        </span>
        <a
          href="https://github.com/Corgan/idleon-research-optimizer/blob/main/drop-rate-calc.html"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-400 hover:text-gold no-underline"
          title="Structure mirrors Corgan's drop-rate-calc.html"
        >
          (Corgan-style)
        </a>
      </h1>
      <p className="text-center text-xs text-zinc-500 mb-4">
        Auto-computes from save JSON. Select character &amp; map. All processing
        local in your browser.
      </p>

      {/* Import box (collapsible like Corgan) */}
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
        {baseDr !== null && factor > 1.001 && (
          <div className="text-xs text-zinc-600 mt-1">
            (base {formatIdleon(baseDr)}x × {factor.toFixed(2)}x map)
          </div>
        )}
      </div>

      {/* Formula breakdown tree — IT-style (validated) or Corgan-style (pool tree) */}
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
              aria-selected={tab === "corgan"}
              onClick={() => setTab("corgan")}
              className={`px-3 py-1 text-xs rounded ${
                tab === "corgan"
                  ? "bg-gold/15 text-gold border border-gold/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Mirrors Corgan's drop-rate-calc pool structure: LUK Scaling → ×1.4 → Main Additive → LUK2 Additive → Sum/100+1 → Chip Cap-Break → Post-Processing"
            >
              🎲 Corgan-style
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
              title="The IT-port breakdown — validated to match idleontoolbox.com exactly"
            >
              📊 IT-style
            </button>
          </div>
        </div>
        {tab === "corgan" && corganTotal !== null && (
          <div className="mb-3 text-xs text-zinc-500">
            Corgan total:{" "}
            <span className="text-amber-300 font-mono">
              {corganTotal.toFixed(3)}x
            </span>{" "}
            — diverges from the IT-style total above on a few sources where
            Corgan&rsquo;s formula differs from IT&rsquo;s (notably
            grid&nbsp;168 / Glimbo&nbsp;DR which Corgan multiplies by trade
            groups vs. IT&rsquo;s sub-field read). Stage&nbsp;5b closed
            tome&nbsp;score, unique&nbsp;sushi cache, and meritoc; remaining
            gap traces to the mainframe BFS, stamp doubler chain, and full{" "}
            <code className="text-zinc-400">computeTotalStat</code> pipeline.
            Tree <em>shape</em> matches Corgan 1:1.
          </div>
        )}
        {computing ? (
          <p className="text-sm text-zinc-500 italic">Computing…</p>
        ) : tab === "corgan" ? (
          <CorganTree tree={corganTree} />
        ) : (
          <DrTree tree={tree} />
        )}
      </div>
    </div>
  );
}
