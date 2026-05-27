"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DeepView from "@/components/dropRate/DeepView";
import {
  listCharacters,
  parseSave,
  type CharSummary,
} from "@/lib/dropRate/extract";
import {
  TALENT_TABS_BY_CLASS,
  type TalentEntry,
  type TalentTab,
} from "@/lib/talentsLevel/talentTabs.gen";
import {
  getCharClassKey,
  getCharClassLabel,
} from "@/lib/talentsLevel/charClass";
import type { CorganNode } from "@/lib/corgan/node";

const SAVE_KEY = "talents-level.last-upload.v1";
const TALENT_KEY = "talents-level.talent-id.v1";
const TAB_KEY = "talents-level.tab-idx.v1";

// Fallback class key when the save doesn't have a parseable class (or
// before save load). Beginner shows the entry-level tree which is the
// least intimidating empty state.
const FALLBACK_CLASS_KEY = "Beginner";

// Strip the IT data's "{" / "}" formula-placeholder tokens out of the
// lvlUpText we render under each talent card — they read as garbage in a
// detached UI (the in-game pass replaces them with the current value, but
// we just want the human-readable bonus name).
function cleanLvlUpText(s: string): string {
  return s.replace(/[{}_]/g, " ").replace(/\s+/g, " ").trim();
}

// IT-style tab name → display label. The website-data keys use underscores
// and we get nicer headers swapping them out, plus we drop the "Special "
// prefix to keep the tab strip compact ("Star 1" / "Star 2" reads tighter).
function tabDisplayName(rawName: string): string {
  if (rawName.startsWith("Special Talent ")) {
    return "⭐ Star " + rawName.replace("Special Talent ", "");
  }
  return rawName.replace(/_/g, " ");
}

export default function TalentsLevelPageClient() {
  const [jsonText, setJsonText] = useState("");
  const [save, setSave] = useState<any | null>(null);
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [talentId, setTalentId] = useState<number>(279); // Robbing Hood default
  const [tabIdx, setTabIdx] = useState<number>(0);
  const [tree, setTree] = useState<CorganNode | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageSave = useCallback(
    (text: string, opts: { silent?: boolean } = {}) => {
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
        try {
          window.localStorage.setItem(SAVE_KEY, text);
        } catch {
          // quota exceeded — non-fatal
        }
        setError(null);
        return true;
      } catch (e) {
        if (!opts.silent) {
          setError(e instanceof Error ? e.message : String(e));
        }
        return false;
      }
    },
    []
  );

  // Hydrate save + last-picked talent + last-picked tab on mount so the
  // page survives reloads.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) stageSave(raw, { silent: true });
      const lastTalent = window.localStorage.getItem(TALENT_KEY);
      if (lastTalent) {
        const n = Number(lastTalent);
        if (Number.isFinite(n)) setTalentId(n);
      }
      const lastTab = window.localStorage.getItem(TAB_KEY);
      if (lastTab) {
        const n = Number(lastTab);
        if (Number.isFinite(n)) setTabIdx(n);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist talent + tab selection.
  useEffect(() => {
    try {
      window.localStorage.setItem(TALENT_KEY, String(talentId));
    } catch {
      // ignore
    }
  }, [talentId]);
  useEffect(() => {
    try {
      window.localStorage.setItem(TAB_KEY, String(tabIdx));
    } catch {
      // ignore
    }
  }, [tabIdx]);

  // Resolve the active char's class → talent tab list. Falls back to
  // Beginner when no save is loaded (so the picker still renders something
  // visual on the empty state).
  const classKey = useMemo(() => {
    if (!save) return FALLBACK_CLASS_KEY;
    return getCharClassKey(save, charIdx) ?? FALLBACK_CLASS_KEY;
  }, [save, charIdx]);
  const classLabel = useMemo(() => {
    if (!save) return "—";
    return getCharClassLabel(save, charIdx) ?? "—";
  }, [save, charIdx]);
  const tabs: TalentTab[] = useMemo(() => {
    return TALENT_TABS_BY_CLASS[classKey]?.tabs ?? [];
  }, [classKey]);

  // Clamp tab index whenever the available tabs change (switching from a
  // 5-tab class to a 3-tab class would leave the stored idx out of range).
  useEffect(() => {
    if (tabs.length === 0) return;
    if (tabIdx >= tabs.length) setTabIdx(tabs.length - 1);
  }, [tabs.length, tabIdx]);

  const currentTab: TalentTab | null = tabs[tabIdx] ?? null;

  // Whenever save/char/talent changes, recompute the FULL talent tree.
  // Lazy-imported so the corgan bundle stays out of the initial page load.
  useEffect(() => {
    if (!save || chars.length === 0) {
      setTree(null);
      setComputing(false);
      return;
    }
    let cancelled = false;
    setComputing(true);
    (async () => {
      try {
        const mod = await import("@/lib/talentsLevel/compute");
        if (cancelled) return;
        const result = mod.computeTalentEffective(save, charIdx, talentId);
        setTree(result.tree);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(
            "Talent compute failed: " +
              (e instanceof Error ? e.message : String(e))
          );
        }
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [save, charIdx, talentId, chars.length]);

  const onLoad = () => {
    if (!jsonText.trim()) {
      setError("Paste a raw save JSON first.");
      return;
    }
    if (stageSave(jsonText)) setJsonText("");
  };

  // Look up the headline talent inside the active tab so we can show its
  // friendly name + bonus line in the headline card. Falls back to a
  // search across all tabs of the active class if the user picked a
  // talent that's not in the current tab (happens when switching classes
  // since the talentId persists across class changes).
  const selectedTalent: TalentEntry | null = useMemo(() => {
    for (const tab of tabs) {
      for (const t of tab.talents) {
        if (t.id === talentId) return t;
      }
    }
    return null;
  }, [tabs, talentId]);

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <h1 className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-3xl font-extrabold text-gold">
          🌟 Talents Level
        </span>
      </h1>
      <p className="text-center text-xs text-zinc-500 mb-4">
        Pick a talent from the visual grid below and see its full bonus
        breakdown — same tree the Drop Rate page emits, scoped to one
        talent. Tabs follow the character&apos;s class promotion chain plus
        the four Special Talent (star) pages.
      </p>

      {/* Import Save — same layout language as DrCalculator. */}
      <details
        open
        className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800"
      >
        <summary className="cursor-pointer select-none flex items-center gap-x-2 gap-y-1 flex-wrap mb-3">
          <span className="font-semibold text-gold">📋 Import Save JSON</span>
          <span className="text-xs text-zinc-500 font-normal">
            Use the &ldquo;Copy for Support&rdquo; button on{" "}
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
        <div className="flex flex-col gap-3">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='Paste the output of "Copy for Support" here (Ctrl+V)…'
            className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-gold"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onLoad}
              className="px-4 py-1.5 text-sm font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
            >
              Load Save
            </button>
            <select
              value={charIdx}
              disabled={chars.length === 0}
              onChange={(e) => setCharIdx(Number(e.target.value))}
              className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-sky-300 disabled:opacity-40"
              title="Character whose talent levels will populate the tree"
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
            <span className="text-xs text-zinc-500">
              Class:{" "}
              <span className="text-zinc-300 font-medium">{classLabel}</span>
            </span>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </details>

      {/* Talent picker — tab strip + grid of icon cards. Replaces the
          previous search+select combo. */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3 mb-4">
        {/* Tab strip — horizontal scroll on narrow viewports so 5-class
            chains + 4 star pages don't overflow the card. */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.length === 0 ? (
            <span className="text-xs text-zinc-500 italic px-2 py-1.5">
              No tabs available for this class.
            </span>
          ) : (
            tabs.map((tab, i) => {
              const active = i === tabIdx;
              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => setTabIdx(i)}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                    active
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                  title={tab.name}
                >
                  {tabDisplayName(tab.name)}
                </button>
              );
            })
          )}
        </div>

        {/* Talent grid — fixed 5 columns on desktop (matches in-game grid
            layout), drops to 3 on narrow screens. Each card has icon +
            short label. */}
        {currentTab ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {currentTab.talents.map((t) => {
              const selected = t.id === talentId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTalentId(t.id)}
                  className={`group flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                    selected
                      ? "border-gold bg-amber-500/10 ring-1 ring-amber-500/40"
                      : "border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900 hover:border-zinc-700"
                  }`}
                  title={`${t.name} (Talent ${t.id})\n${cleanLvlUpText(t.description)}`}
                >
                  <img
                    src={`/talent-icons/UISkillIcon${t.id}.png`}
                    alt={t.name}
                    className="w-10 h-10 object-contain pixelated"
                    style={{ imageRendering: "pixelated" }}
                    loading="lazy"
                  />
                  <span
                    className={`text-[10px] leading-tight line-clamp-2 ${
                      selected ? "text-amber-200" : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  >
                    {cleanLvlUpText(t.lvlUpText) || t.name.replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-mono">
                    #{t.id}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic px-2">
            Load a save to populate the talent grid.
          </p>
        )}
      </div>

      {/* Headline card — surface the talent's total bonus value. The val
          comes from `tree.val` which IS the bonus the talent contributes
          (post-formula, post-multipliers). */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-5 mb-4 text-center">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Talent Bonus
        </div>
        <div className="text-5xl font-extrabold text-gold mt-1 tabular-nums">
          {tree ? formatTalentVal(tree.val, tree.fmt) : "—"}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {selectedTalent ? (
            <>
              <span className="text-zinc-300">
                {selectedTalent.name.replace(/_/g, " ")}
              </span>{" "}
              <span className="text-zinc-600">(Talent {selectedTalent.id})</span>
              {chars.length > 0 && (
                <>
                  {" "}
                  • Char:{" "}
                  <span className="text-zinc-300">
                    {chars.find((c) => c.charIndex === charIdx)?.charName ??
                      "—"}
                  </span>
                </>
              )}
            </>
          ) : (
            "load a save & pick a talent"
          )}
        </div>
        {selectedTalent && (
          <div className="text-[11px] text-zinc-500 mt-2 italic leading-snug">
            {cleanLvlUpText(selectedTalent.description)}
          </div>
        )}
      </div>

      {/* Tree pane — DeepView fed the FULL talent tree (Active flag,
          Effective Level breakdown / Level for star talents, multipliers
          like Plunderous Kills, etc.). */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 mb-4">
        {!save ? (
          <p className="text-sm text-zinc-500 italic">
            Load a save above to populate the tree.
          </p>
        ) : computing ? (
          <p className="text-sm text-zinc-500 italic">Computing…</p>
        ) : tree ? (
          <DeepView tree={tree} baseline={null} />
        ) : (
          <p className="text-sm text-zinc-500 italic">
            Pick a talent from the grid above.
          </p>
        )}
      </div>

      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Tab 1-5 talents follow the standard Effective Level chain
        (Base + ATL bonus). Star talents are pool-capped, so their tree is
        just Active + Level + formula — no Max Book Lv Cap.
      </footer>
    </main>
  );
}

// Format the talent's bonus value with sensible defaults: multiplier-style
// rendering for x-fmt nodes (Tal 328 is a DR multiplier), additive
// rendering for everything else. Strips trailing zeroes for readability.
function formatTalentVal(v: number, fmt: string | undefined): string {
  if (!Number.isFinite(v)) return "—";
  if (fmt === "x") {
    return v.toFixed(3).replace(/\.?0+$/, "") + "x";
  }
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(2).replace(/\.?0+$/, "");
  return v.toFixed(3).replace(/\.?0+$/, "");
}
