"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DeepView from "@/components/dropRate/DeepView";
import {
  listCharacters,
  parseSave,
  type CharSummary,
} from "@/lib/dropRate/extract";
import { getTalentList } from "@/lib/talentsLevel/talentList";
import type { CorganNode } from "@/lib/corgan/node";

const SAVE_KEY = "talents-level.last-upload.v1";
const TALENT_KEY = "talents-level.talent-id.v1";

// Pre-build the talent list at module scope — it never changes within a
// session and ~350 entries is small enough to live in a single Array.
const TALENTS = getTalentList();

// Default talent: Robbing Hood (279) since it's the headline DR talent users
// looking at this page are most likely interested in. Falls back to the
// first entry in the list if 279 is somehow missing (shouldn't happen).
const DEFAULT_TALENT_ID =
  TALENTS.find((t) => t.id === 279)?.id ?? TALENTS[0]?.id ?? 1;

export default function TalentsLevelPageClient() {
  const [jsonText, setJsonText] = useState("");
  const [save, setSave] = useState<any | null>(null);
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [talentId, setTalentId] = useState<number>(DEFAULT_TALENT_ID);
  const [talentSearch, setTalentSearch] = useState<string>("");
  const [tree, setTree] = useState<CorganNode | null>(null);
  const [fullTalentNode, setFullTalentNode] = useState<CorganNode | null>(null);
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

  // Hydrate save + last-picked talent on mount so the page survives reload.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) stageSave(raw, { silent: true });
      const lastTalent = window.localStorage.getItem(TALENT_KEY);
      if (lastTalent) {
        const n = Number(lastTalent);
        if (Number.isFinite(n) && TALENTS.some((t) => t.id === n)) {
          setTalentId(n);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist talent selection so refreshes don't snap back to default.
  useEffect(() => {
    try {
      window.localStorage.setItem(TALENT_KEY, String(talentId));
    } catch {
      // ignore
    }
  }, [talentId]);

  // Whenever save/char/talent changes, recompute the Effective Level subtree.
  // Lazy-imported so the corgan bundle stays out of the initial page load.
  useEffect(() => {
    if (!save || chars.length === 0) {
      setTree(null);
      setFullTalentNode(null);
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
        setFullTalentNode(result.full);
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

  // Filter the talent dropdown by the search input. Empty search → show
  // everything. Match against the precomputed lowercase `searchKey` so the
  // filter scales to hundreds of entries without per-keystroke alloc.
  const filteredTalents = useMemo(() => {
    const q = talentSearch.trim().toLowerCase();
    if (!q) return TALENTS;
    return TALENTS.filter((t) => t.searchKey.includes(q));
  }, [talentSearch]);

  const selectedTalent = TALENTS.find((t) => t.id === talentId);

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <h1 className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-3xl font-extrabold text-gold">
          🌟 Talents Level
        </span>
      </h1>
      <p className="text-center text-xs text-zinc-500 mb-4">
        Pick a talent and see how its Effective Level breaks down — Base Level
        (min of points invested and the Max Book Lv Cap) plus the full chain
        of Bonus Levels stacking on top. Same tree structure as the Drop Rate
        page, scoped to a single talent.
      </p>

      {/* Import Save — same layout language as DrCalculator so users
          oscillating between the two pages don't have to relearn the form. */}
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
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </details>

      {/* Talent picker — search input + native <select> driven by the same
          filtered list. We don't use a combobox library here: a 350-entry
          list with a simple search filter fits in a single <select> and
          stays keyboard-accessible by default. */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 mb-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Talent
          </span>
          <input
            type="text"
            value={talentSearch}
            onChange={(e) => setTalentSearch(e.target.value)}
            placeholder="🔍 filter by name…"
            className="w-full px-2 py-1.5 text-sm bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold"
          />
          <select
            value={talentId}
            onChange={(e) => setTalentId(Number(e.target.value))}
            size={Math.min(10, Math.max(3, filteredTalents.length))}
            className="w-full px-2 py-1.5 text-sm bg-zinc-950 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-gold font-mono"
          >
            {filteredTalents.length === 0 ? (
              <option disabled>— no matches —</option>
            ) : (
              filteredTalents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Talent {t.id})
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {/* Headline card — surface the talent's name, its in-tree Effective
          Level value, and the full talent value (post-formula). Keeps the
          page parallel to /drop-rate where the Big DR card anchors the
          tree below it. */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-5 mb-4 text-center">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Effective Level
        </div>
        <div className="text-5xl font-extrabold text-gold mt-1 tabular-nums">
          {tree ? tree.val.toLocaleString() : "—"}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {selectedTalent ? (
            <>
              Talent:{" "}
              <span className="text-zinc-300">
                {selectedTalent.name} (Talent {selectedTalent.id})
              </span>
              {chars.length > 0 && (
                <>
                  {" "}
                  • Character:{" "}
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
        {fullTalentNode && tree && (
          <div className="text-[10px] text-zinc-600 mt-2 italic leading-snug">
            Talent value (post-formula):{" "}
            <span className="text-zinc-500 font-mono">
              {fullTalentNode.val.toFixed(2)}
            </span>
            {fullTalentNode.note && (
              <>
                {" — "}
                <span className="text-zinc-600">{fullTalentNode.note}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tree pane — DeepView from the DR page, fed only the Effective Level
          subtree. Same rendering, expand/collapse, search, hide-zero, and
          hide-notes behaviors carry over. */}
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
            This talent has no Effective Level breakdown for the selected
            character (likely a star talent or a talent the resolver short-
            circuits — try a different talent).
          </p>
        )}
      </div>

      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Same compute path as the Drop Rate page&apos;s talent rows — the cap
        (Max Book Lv) is account-wide and the bonus chain is per-character.
      </footer>
    </main>
  );
}
