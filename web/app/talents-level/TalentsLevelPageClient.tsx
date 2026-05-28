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
import { getActivePresetIdx } from "@/lib/talentsLevel/compute";
import { isAccountWideTalent } from "@/lib/talentsLevel/accountWideTalents";
import type { CorganNode } from "@/lib/corgan/node";

const SAVE_KEY = "talents-level.last-upload.v1";
const TALENT_KEY = "talents-level.talent-id.v1";
const TAB_KEY = "talents-level.tab-idx.v1";
const PRESET_KEY = "talents-level.preset-idx.v1";

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

// ── Headline summary extraction ──────────────────────────────────────────
// The page surfaces "current effective level" vs "max effective level" so
// the user can see at a glance how much room they have to grow. Pulling
// those numbers means walking the talent tree the resolver emits, which
// has different shapes depending on the talent:
//   - Normal tab 1-5  : Active → Effective Level → Base Level (Points
//                       Invested + Max Cap) + Bonus Levels
//   - Star talents    : Active → Level (raw rawLv)
//   - Tal 655 special : Base Level (raw) + Per Skull + Skulls Beaten
//   - Tal 328 special : Active → Talent Value (with Effective Level inside)
//                       + Plunderous Kills
// We try the "normal" walk first because it's the most common; fall back to
// star shape for everything else.

type TalentSummary = {
  /** Current effective level (rawLv invested + bonus chain + super). Null
   *  when the tree doesn't expose a Bonus Levels node — e.g. star talents. */
  currentEffective: number | null;
  /** Max effective level if Points Invested were bumped to the cap. Null
   *  when no Max Book Lv Cap kid is in the tree. */
  maxEffective: number | null;
  /** Actual investment (rawLv). For star talents this IS the Level. */
  pointsInvested: number;
  /** Max Book Lv Cap. Star talents have no such cap → null. */
  maxCap: number | null;
  /** ATL bonus chain total. Star talents have 0 here (cleared in talent.ts
   *  via computeAllTalentLVz returning 0 for idx > 614). */
  bonusLevels: number;
  /** Spelunk Super Talent contribution, exposed as a separate row on
   *  /talents-level (see ctx.splitSuperLevels in compute.ts). 0 when the
   *  talent isn't super-active for the active char's preset OR when it
   *  can't be super at all (49-59 / 149 / 374 / 539 / 505 / >614, plus
   *  any talent the game's UI restricts from the Spelunking 4D slot). */
  superLevels: number;
};

function getChildByName(node: CorganNode, name: string): CorganNode | null {
  if (!node.children) return null;
  for (const c of node.children) {
    if (c.name === name) return c;
  }
  return null;
}

function findDescendant(node: CorganNode, name: string): CorganNode | null {
  if (node.name === name) return node;
  if (!node.children) return null;
  for (const c of node.children) {
    const r = findDescendant(c, name);
    if (r) return r;
  }
  return null;
}

/** Find the TARGET talent's Effective Level node, skipping any
 *  "Effective Level" that lives inside a cap sub-tree. The cap holds
 *  booster talents (Tal 488, 533, 53...) — each of which is a fully-
 *  resolved talent tree with its OWN "Effective Level", "Base Level",
 *  "Points Invested", "Bonus Levels" etc. A naive depth-first
 *  findDescendant would return those nested nodes and mix metrics from
 *  the booster char into the target's summary (which is exactly how
 *  Max Effective LV broke after we started embedding booster sub-trees
 *  under the cap). */
function findTargetEffectiveLevel(node: CorganNode): CorganNode | null {
  if (node.name === "Effective Level") return node;
  if (!node.children) return null;
  for (const c of node.children) {
    // Don't recurse into cap sub-trees — anything below them belongs
    // to a booster, not to the target.
    if (
      c.name === "Talent Cap (base + boosters)" ||
      c.name === "Max Book Lv Cap"
    ) {
      continue;
    }
    const r = findTargetEffectiveLevel(c);
    if (r) return r;
  }
  return null;
}

function extractTalentSummary(tree: CorganNode | null): TalentSummary | null {
  if (!tree) return null;
  // Walk to the target's own Effective Level (skipping nested booster
  // trees), then pull all the metric kids as DIRECT children:
  //
  //   Effective Level
  //   ├── Base Level
  //   │   ├── Points Invested
  //   │   └── Talent Cap (base + boosters)   ← OR "Max Book Lv Cap"
  //   ├── Bonus Levels
  //   └── Super Levels                       ← only when split mode
  //
  // For Tal 328 the Effective Level sits inside "Talent Value", which
  // findTargetEffectiveLevel handles transparently — it recurses into
  // non-cap children until it finds the target's own Effective Level.
  const effective = findTargetEffectiveLevel(tree);
  const baseLevelNode = effective
    ? getChildByName(effective, "Base Level")
    : null;
  const pointsKid = baseLevelNode
    ? getChildByName(baseLevelNode, "Points Invested")
    : null;
  // Cap can be one of two shapes:
  //   - "Max Book Lv Cap"           — default account-wide maxBookLv path
  //   - "Talent Cap (base + boosters)" — per-talent override from
  //     TALENT_CAP_BOOSTERS (e.g. Tal 10/11/12/23/75/79/86/87/266/267/
  //     446/447). When present, this is THE cap for the target talent.
  const capKid = baseLevelNode
    ? getChildByName(baseLevelNode, "Talent Cap (base + boosters)") ||
      getChildByName(baseLevelNode, "Max Book Lv Cap")
    : null;
  const bonusKid = effective
    ? getChildByName(effective, "Bonus Levels")
    : null;
  const superKid = effective
    ? getChildByName(effective, "Super Levels")
    : null;

  if (effective || (pointsKid && capKid)) {
    // Normal-shape tree (or Tal 328 which still emits Base+Bonus inside).
    const points = pointsKid ? Number(pointsKid.val) : 0;
    const cap = capKid ? Number(capKid.val) : null;
    const bonus = bonusKid ? Number(bonusKid.val) : 0;
    const sup = superKid ? Number(superKid.val) || 0 : 0;
    const current = effective
      ? Number(effective.val)
      : points + bonus + sup;
    const max = cap != null ? cap + bonus + sup : null;
    return {
      currentEffective: current,
      maxEffective: max,
      pointsInvested: points,
      maxCap: cap,
      bonusLevels: bonus,
      superLevels: sup,
    };
  }

  // Star-talent shape — Active + Level kids, no Effective Level wrapper.
  const levelKid = getChildByName(tree, "Level");
  if (levelKid) {
    const lv = Number(levelKid.val) || 0;
    return {
      currentEffective: lv,
      maxEffective: null,
      pointsInvested: lv,
      maxCap: null,
      bonusLevels: 0,
      superLevels: 0,
    };
  }

  // Tal 655 shape — Base Level + Per Skull + Skulls Beaten kids.
  const baseLevelDirect = getChildByName(tree, "Base Level");
  if (baseLevelDirect) {
    const lv = Number(baseLevelDirect.val) || 0;
    return {
      currentEffective: lv,
      maxEffective: null,
      pointsInvested: lv,
      maxCap: null,
      bonusLevels: 0,
      superLevels: 0,
    };
  }

  return null;
}

export default function TalentsLevelPageClient() {
  const [jsonText, setJsonText] = useState("");
  const [save, setSave] = useState<any | null>(null);
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [talentId, setTalentId] = useState<number>(279); // Robbing Hood default
  const [tabIdx, setTabIdx] = useState<number>(0);
  // Preset 1 (0) vs Preset 2 (1). Defaults to the char's currently-active
  // preset when a save loads (we read PlayerStuff_{ci}[1] for that). The
  // user can flip to inspect the other preset's talent investments.
  const [presetIdx, setPresetIdx] = useState<0 | 1>(0);
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
      const lastPreset = window.localStorage.getItem(PRESET_KEY);
      if (lastPreset === "0" || lastPreset === "1") {
        setPresetIdx(Number(lastPreset) as 0 | 1);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist talent + tab + preset selection.
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
  useEffect(() => {
    try {
      window.localStorage.setItem(PRESET_KEY, String(presetIdx));
    } catch {
      // ignore
    }
  }, [presetIdx]);

  // When save loads or char changes, snap presetIdx to whatever's active
  // in the save for that char. The user can then toggle to the other
  // preset manually. Skip when no save is loaded.
  const activePresetIdx = useMemo(() => {
    if (!save || chars.length === 0) return 0;
    return getActivePresetIdx(save, charIdx);
  }, [save, charIdx, chars.length]);
  useEffect(() => {
    if (!save) return;
    setPresetIdx(activePresetIdx);
  }, [save, charIdx, activePresetIdx]);

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
        const result = mod.computeTalentEffective(save, charIdx, talentId, {
          presetIdx,
        });
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
  }, [save, charIdx, talentId, chars.length, presetIdx]);

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
    // Wider container than /drop-rate because the visual picker has to fit
    // 9 tabs (5 chain + 4 star) on master-class chars without horizontal
    // scrolling. max-w-3xl was too tight — Death Bringer / Wind Walker /
    // Arcane Cultist were overflowing.
    <main className="max-w-5xl mx-auto px-3 pb-12">
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

          {/* Preset selector — each char has two talent presets (in-game
              you can swap between them with the talent UI's preset
              tabs). SL_{ci} holds the active preset's levels, SLpre_{ci}
              the other. We default to the active one but let the user
              flip to inspect the other side. */}
          {save && chars.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">Preset:</span>
              <div className="inline-flex gap-1">
                {[0, 1].map((idx) => {
                  const isActive = idx === presetIdx;
                  const isInGameActive = idx === activePresetIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPresetIdx(idx as 0 | 1)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        isActive
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800"
                      }`}
                      title={
                        isInGameActive
                          ? `Preset ${idx + 1} — currently active in-game on this char`
                          : `Preset ${idx + 1} — inactive on this char (data from SLpre_${charIdx})`
                      }
                    >
                      Preset {idx + 1}
                      {isInGameActive && (
                        <span className="ml-1 text-[9px] text-emerald-400 font-mono">
                          ●
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </details>

      {/* Talent picker — tab strip + grid of icon cards. Replaces the
          previous search+select combo.
          Hidden when no save is loaded: without a char's class we'd
          fall back to Beginner's tabs which is misleading filler. The
          headline + tree below already show their own empty-state hint
          ("load a save above to populate the tree"), so the page reads
          as a clean "load a save first" prompt. */}
      {save && (
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
              const accountWide = isAccountWideTalent(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTalentId(t.id)}
                  className={`group relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                    selected
                      ? "border-gold bg-amber-500/10 ring-1 ring-amber-500/40"
                      : "border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900 hover:border-zinc-700"
                  }`}
                  title={
                    `${t.name} (Talent ${t.id})\n${cleanLvlUpText(t.description)}` +
                    (accountWide
                      ? "\n\n🌐 Account-wide: bonus applies to all chars via the highest owner-class char (super talent contribution does NOT propagate)."
                      : "")
                  }
                >
                  {accountWide && (
                    <span
                      className="absolute top-1 right-1 text-[9px] leading-none px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono"
                      aria-label="Account-wide talent"
                    >
                      🌐
                    </span>
                  )}
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
      )}

      {/* Headline card — three-pane layout: the bonus the talent gives
          (left), the current effective level breakdown (middle), and the
          max effective level if the user maxed Points Invested up to the
          Book Lv Cap (right). The middle/right panes degrade gracefully
          for star talents (no cap → just show Level). */}
      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Bonus pane. Carries the talent's lvlUpText description so the
              user knows WHAT the bonus value (the gold number) actually
              represents — previously a centered row under the whole card
              that lost its visual link to the bonus. */}
          <div className="text-center sm:border-r sm:border-zinc-800 sm:pr-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Talent Bonus
            </div>
            <div className="text-4xl font-extrabold text-gold mt-1 tabular-nums leading-tight">
              {tree ? formatTalentVal(tree.val, tree.fmt) : "—"}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              {tree?.fmt === "x" ? "multiplier" : "additive"}
            </div>
            {selectedTalent && (
              <div className="text-[11px] text-zinc-500 mt-2 italic leading-snug">
                {cleanLvlUpText(selectedTalent.description)}
              </div>
            )}
          </div>

          {/* Current effective level. The breakdown row shows Points
              Invested + Bonus Levels = the green big number. */}
          <CurrentEffectivePane
            summary={tree ? extractTalentSummary(tree) : null}
          />

          {/* Max effective level — what the user could reach by pushing
              Points Invested up to the cap. Empty for star talents which
              don't have a separate cap. */}
          <MaxEffectivePane
            summary={tree ? extractTalentSummary(tree) : null}
          />
        </div>

        {/* Identity row — talent name + char, plus the description tooltip
            in italics for context. */}
        <div className="text-xs text-zinc-500 mt-4 text-center">
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

// Integer-style formatter for the level numbers in the effective-level
// panes. talents always level in whole numbers so the toFixed(0) gives a
// clean read; we don't want "33.000" cluttering the headline.
function formatLevel(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toString();
}

// Format the "invested + bonus + super" breakdown shared by both the
// current and max panes. Omits zero-value parts so a talent with no bonus
// chain and no super reads as just the leading number.
function breakdownLine(parts: Array<{ label: string; value: number }>): string {
  const nonZero = parts.filter((p) => p.value > 0);
  if (nonZero.length === 0) return formatLevel(parts[0]?.value ?? 0) + " " + (parts[0]?.label ?? "");
  return nonZero
    .map((p) => `${formatLevel(p.value)} ${p.label}`)
    .join(" + ");
}

function CurrentEffectivePane({
  summary,
}: {
  summary: TalentSummary | null;
}) {
  return (
    <div className="text-center sm:border-r sm:border-zinc-800 sm:pr-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        Current Effective Lv
      </div>
      <div className="text-4xl font-extrabold text-sky-300 mt-1 tabular-nums leading-tight">
        {formatLevel(summary?.currentEffective ?? null)}
      </div>
      <div className="text-[10px] text-zinc-600 mt-1 font-mono">
        {summary
          ? breakdownLine([
              { label: "invested", value: summary.pointsInvested },
              { label: "bonus", value: summary.bonusLevels },
              { label: "super", value: summary.superLevels },
            ])
          : "—"}
      </div>
    </div>
  );
}

function MaxEffectivePane({
  summary,
}: {
  summary: TalentSummary | null;
}) {
  const hasCap = summary && summary.maxCap != null;
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        Max Effective Lv
      </div>
      <div
        className={`text-4xl font-extrabold mt-1 tabular-nums leading-tight ${
          hasCap ? "text-emerald-300" : "text-zinc-600"
        }`}
      >
        {hasCap ? formatLevel(summary!.maxEffective) : "—"}
      </div>
      <div className="text-[10px] text-zinc-600 mt-1 font-mono">
        {hasCap
          ? breakdownLine([
              { label: "cap", value: summary!.maxCap! },
              { label: "bonus", value: summary!.bonusLevels },
              { label: "super", value: summary!.superLevels },
            ])
          : "star talent — no cap"}
      </div>
    </div>
  );
}
