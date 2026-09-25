"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultCharIndex, listCharacters, parseSave, type CharSummary } from "@/lib/dropRate/extract";
import { getCharClassKey } from "@/lib/talentsLevel/charClass";
import DeepView, { type DeepViewExtraTab } from "@/components/dropRate/DeepView";
import ProfileNameLoader from "@/components/ProfileNameLoader";
import { accountAutoLoads } from "@/lib/gameAuth/session";
import { buildStatMapOptions, type StatMapOption } from "@/lib/statTracker/mapOptions";
import type { ArkhNode } from "@/lib/arkh/node";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import type { StatPageConfig } from "@/lib/statTracker/config";

export type StatCalculatorState = {
  charIndex: number | null;
  charName: string;
  /** PascalCase class key of the selected char (picks the per-class Observed Max). */
  classKey: string | null;
  charSummary: CharSummary | null;
  total: number | null;
  mapIndex: number;
  mapLabel: string;
  save: any;
  tree: ArkhNode | null;
  /** Compute error (`<errPrefix>: …`) or null. */
  computeError: string | null;
};

type Props = {
  config: StatPageConfig;
  onStateChange?: (s: StatCalculatorState) => void;
  compareBaseline?: { flatTree: FlatTree; capturedAt: number; charName: string } | null;
  snapshotSlot?: React.ReactNode;
  extraTabs?: DeepViewExtraTab[];
  extraTabsFirst?: boolean;
  defaultView?: string;
};

export default function StatCalculator({
  config,
  onStateChange,
  compareBaseline,
  snapshotSlot,
  extraTabs,
  extraTabsFirst,
  defaultView,
}: Props) {
  const [jsonText, setJsonText] = useState("");
  const [save, setSave] = useState<any | null>(null);
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [mapIdx, setMapIdx] = useState<number>(0);
  const [mapOptions, setMapOptions] = useState<StatMapOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<ArkhNode | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const unit = config.unit ?? "x";

  // A refresh of the same account (auto-update / Sync now) keeps the map;
  // a fresh load re-derives it from the save.
  const keepViewRef = useRef(false);
  const lastCharIdxRef = useRef(charIdx);

  const applyParsedSave = useCallback(
    (parsed: any, opts: { silent?: boolean; keepView?: boolean } = {}) => {
      try {
        const list = listCharacters(parsed);
        if (list.length === 0) {
          if (!opts.silent) setError("Save parsed but no characters found.");
          return false;
        }
        keepViewRef.current = !!opts.keepView;
        setSave(parsed);
        setChars(list);
        // Fresh load: default to whoever's online now (else the first
        // character). Refresh: keep today's logic (the previous char, if
        // still present). Map fallback below uses the SAME character so the
        // "jump to current map" effect can't override it with a different one.
        const fallbackChar = opts.keepView
          ? list.some((c) => c.charIndex === lastCharIdxRef.current)
            ? lastCharIdxRef.current
            : list[0].charIndex
          : defaultCharIndex(parsed, list);
        setCharIdx((prev) =>
          opts.keepView ? (list.some((c) => c.charIndex === prev) ? prev : list[0].charIndex) : fallbackChar
        );
        const maps = buildStatMapOptions(parsed);
        setMapOptions(maps);
        const data = (parsed as any)?.data ?? {};
        const currentMap = Number(data[`CurrentMap_${fallbackChar}`]) || 0;
        const fallback = maps.some((m) => m.index === currentMap) ? currentMap : maps[0]?.index ?? 0;
        setMapIdx((prev) => (opts.keepView && maps.some((m) => m.index === prev) ? prev : fallback));
        setError(null);
        return true;
      } catch (e) {
        if (!opts.silent) setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    []
  );

  const stageSave = useCallback(
    (text: string, opts: { silent?: boolean } = {}) => {
      let parsed: unknown;
      try {
        parsed = parseSave(text);
      } catch (e) {
        if (!opts.silent) setError(e instanceof Error ? e.message : String(e));
        return false;
      }
      const ok = applyParsedSave(parsed, opts);
      if (ok) {
        try {
          window.localStorage.setItem(config.storage.save, text);
        } catch {
          // quota exceeded
        }
      }
      return ok;
    },
    [applyParsedSave, config.storage.save]
  );

  // Restore a pasted save unless the name loader / signed-in account will
  // put one on screen (this effect runs after the loader's).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(config.storage.name) || accountAutoLoads()) return;
      const raw = window.localStorage.getItem(config.storage.save);
      if (raw) stageSave(raw, { silent: true });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing character jumps to that character's current map.
  useEffect(() => {
    if (!save || chars.length === 0) return;
    const charChanged = lastCharIdxRef.current !== charIdx;
    lastCharIdxRef.current = charIdx;
    if (keepViewRef.current && !charChanged) return;
    const data = (save as any)?.data ?? {};
    const currentMap = Number(data[`CurrentMap_${charIdx}`]) || 0;
    setMapIdx(mapOptions.some((m) => m.index === currentMap) ? currentMap : mapOptions[0]?.index ?? 0);
  }, [charIdx, save, chars.length, mapOptions]);

  useEffect(() => {
    if (!save || chars.length === 0) {
      setTree(null);
      setTotal(null);
      setComputing(false);
      return;
    }
    let cancelled = false;
    setComputing(true);
    (async () => {
      try {
        const result = await config.compute(save, charIdx, mapIdx);
        if (cancelled) return;
        setTree(result.tree);
        setTotal(result.total);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(`${config.errPrefix}: ` + (e instanceof Error ? e.message : String(e)));
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [save, charIdx, mapIdx, chars.length, config]);

  useEffect(() => {
    if (!onStateChange) return;
    const ch = chars.find((c) => c.charIndex === charIdx);
    const map = mapOptions.find((m) => m.index === mapIdx);
    onStateChange({
      charIndex: ch ? ch.charIndex : null,
      charName: ch?.charName ?? "",
      classKey: save && ch ? getCharClassKey(save, ch.charIndex) : null,
      charSummary: ch ?? null,
      total,
      mapIndex: mapIdx,
      mapLabel: map?.name ?? `Map ${mapIdx}`,
      save,
      tree,
      computeError: error && error.startsWith(config.errPrefix) ? error : null,
    });
  }, [charIdx, mapIdx, total, tree, chars, mapOptions, save, onStateChange, error, config]);

  const onLoad = () => {
    if (!jsonText.trim()) {
      setError("Paste a raw save JSON first.");
      return;
    }
    if (stageSave(jsonText)) setJsonText("");
  };

  return (
    <div>
      <h1 className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-3xl font-extrabold text-gold">{config.emoji} {config.calculatorTitle}</span>
      </h1>
      <p className="text-center text-xs text-zinc-500 mb-4">{config.subtitle}</p>

      <ProfileNameLoader
        storageKey={config.storage.name}
        onSave={(s, meta) => applyParsedSave(s, { keepView: meta?.refresh })}
        onError={(msg) => setError(msg)}
      >
        <details className="rounded-lg bg-zinc-900/40 p-3 border border-zinc-800">
          <summary className="cursor-pointer select-none flex items-center gap-2 flex-wrap">
            <span className="dt-arrow text-zinc-500 text-sm">▸</span>
            <span className="font-semibold text-gold">📋 Or paste a save manually</span>
            <span className="text-xs text-zinc-500 font-normal">
              Uses the &ldquo;Copy for Support&rdquo; button on{" "}
              <a
                href="https://idleontoolbox.com"
                target="_blank"
                rel="noreferrer"
                className="text-gold hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                idleontoolbox.com
              </a>
            </span>
          </summary>
          <div className="flex flex-col gap-3 mt-3">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='Paste the output of "Copy for Support" here (Ctrl+V)…'
              className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={onLoad}
              className="self-start px-4 py-1.5 text-sm font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
            >
              Load pasted save
            </button>
          </div>
        </details>
      </ProfileNameLoader>

      {snapshotSlot && <div className="mb-4">{snapshotSlot}</div>}

      <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800 flex flex-col gap-3">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-sm text-zinc-400 font-medium">Character &amp; map:</span>
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
                  {`${c.charName} (Lv ${c.level})`}
                </option>
              ))
            )}
          </select>
          <select
            value={mapIdx}
            disabled={chars.length === 0}
            onChange={(e) => setMapIdx(Number(e.target.value))}
            title={config.mapTitle}
            className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-sky-300 disabled:opacity-40"
          >
            {mapOptions.map((m) => (
              <option key={m.index} value={m.index}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}

        <div className="p-2 rounded border border-zinc-800 bg-zinc-950/60 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-zinc-500">{config.totalLabel}</span>
          <span
            className="text-2xl font-extrabold text-gold tabular-nums"
            title={
              total !== null
                ? config.totalTitle
                  ? config.totalTitle(total)
                  : unit === "%"
                    ? (100 * total).toFixed(2) + "%"
                    : total.toExponential(6) + "x"
                : undefined
            }
          >
            {total !== null ? config.formatTotal(total) + unit : "—"}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 mb-4">
        {computing ? (
          <p className="text-sm text-zinc-500 italic">Computing…</p>
        ) : (
          <DeepView
            tree={tree}
            baseline={compareBaseline ?? null}
            extraTabs={extraTabs}
            extraTabsFirst={extraTabsFirst}
            defaultView={defaultView}
            showWorldView={false}
          />
        )}
      </div>
    </div>
  );
}
