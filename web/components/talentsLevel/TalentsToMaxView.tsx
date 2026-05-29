"use client";

// ============================================================================
// TalentsToMaxView — "To Max" tab for the Talents Level page.
//
// Renders the account-wide scan from lib/talentsLevel/toMax.ts: one
// collapsible section per character, listing the regular talents still
// below their Max Book Lv Cap (sorted by largest gap). Each row shows the
// level invested in BOTH presets (P1 / P2) against the shared cap; the
// preset active in-game is flagged with a ● dot.
//
// Carries its own controls bar (mirrors DeepView's): search, expand /
// collapse / reset of the char sections, a "hide notes" toggle (hides the
// bonus subtitle) and an "active preset only" toggle (drops the inactive
// preset's column + the talents only-missing-there, to cut the noise of
// untouched secondary presets). State is local — it resets when the user
// switches tabs, same as DeepView's tree view.
//
// Pure presentation — all the math lives in computeTalentsToMax().
// ============================================================================

import { useMemo, useState } from "react";
import type { ToMaxCharGroup, ToMaxItem } from "@/lib/talentsLevel/toMax";

export default function TalentsToMaxView({
  groups,
  loading,
}: {
  groups: ToMaxCharGroup[] | null;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [hideNotes, setHideNotes] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  // charIdx → open. Missing key defaults to open.
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({});

  const q = search.trim().toLowerCase();

  // Backlog = groups after the "active preset only" filter (independent of
  // search). `visible` then narrows that by the search term. `complete` is
  // the set already fully at cap for the active filter.
  const { backlog, complete, totalMissing } = useMemo(() => {
    const backlog: ToMaxCharGroup[] = [];
    const complete: ToMaxCharGroup[] = [];
    let totalMissing = 0;
    if (!groups) return { backlog, complete, totalMissing };
    for (const g of groups) {
      let items = g.items;
      if (activeOnly) {
        items = items.filter((it) => {
          const inv = g.activePreset === 0 ? it.investedP1 : it.investedP2;
          return inv < it.cap;
        });
      }
      if (items.length === 0) complete.push(g);
      else {
        totalMissing += items.length;
        backlog.push(items === g.items ? g : { ...g, items });
      }
    }
    return { backlog, complete, totalMissing };
  }, [groups, activeOnly]);

  const matchItem = (it: ToMaxItem) =>
    !q ||
    it.name.toLowerCase().includes(q) ||
    it.tab.toLowerCase().includes(q) ||
    it.bonusText.toLowerCase().includes(q) ||
    String(it.talentId).includes(q.replace("#", ""));

  const visible = useMemo(() => {
    if (!q) return backlog;
    const out: ToMaxCharGroup[] = [];
    for (const g of backlog) {
      const charMatch =
        g.charName.toLowerCase().includes(q) ||
        g.classLabel.toLowerCase().includes(q);
      const items = charMatch ? g.items : g.items.filter(matchItem);
      if (items.length > 0) out.push(charMatch ? g : { ...g, items });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backlog, q]);

  const isOpen = (charIdx: number) => openMap[charIdx] ?? true;
  const setAll = (open: boolean) =>
    setOpenMap(Object.fromEntries(backlog.map((g) => [g.charIdx, open])));

  if (loading) {
    return <p className="text-sm text-zinc-500 italic px-2 py-4">Computing…</p>;
  }
  if (!groups) {
    return (
      <p className="text-sm text-zinc-500 italic px-2 py-4">
        Load a save above to scan the account&apos;s talents.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls bar — mirrors DeepView's layout/styling. */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-900/60">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search talent, character or class…"
          className="flex-1 min-w-[200px] px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500/60"
        />
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            title="Expand every character"
          >
            ↓ Expand
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            title="Collapse every character"
          >
            ↑ Collapse
          </button>
          <button
            type="button"
            onClick={() => setOpenMap({})}
            className="px-2 py-1 text-xs rounded border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title="Reset to default (all open)"
          >
            ↺ Reset
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-sky-500"
          />
          Active preset only
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={hideNotes}
            onChange={(e) => setHideNotes(e.target.checked)}
            className="accent-sky-500"
          />
          Hide notes
        </label>
      </div>

      {totalMissing === 0 ? (
        <p className="text-sm text-emerald-300 px-2 py-2">
          🎉 All talents (tab 1-5) are at the Max Book Lv Cap
          {activeOnly ? " in the active preset" : ", in both presets"}.
        </p>
      ) : (
        <>
          {/* Overall summary (ignores the search term; reflects the backlog). */}
          <div className="text-xs text-zinc-400 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <span className="text-gold font-semibold">{totalMissing}</span>{" "}
              talent{totalMissing === 1 ? "" : "s"} below cap across{" "}
              <span className="text-zinc-200 font-semibold">
                {backlog.length}
              </span>{" "}
              character{backlog.length === 1 ? "" : "s"}
              {activeOnly ? " (active preset)" : " (in some preset)"}.
            </span>
            {!activeOnly && (
              <span className="text-[11px] text-zinc-500">
                P1/P2 = preset 1 / preset 2 ·{" "}
                <span className="text-sky-300">●</span> = active in-game
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-zinc-500 italic px-2 py-2">
              No talent matches the search.
            </p>
          ) : (
            visible.map((g) => (
              <CharSection
                key={g.charIdx}
                group={g}
                open={isOpen(g.charIdx)}
                onToggle={() =>
                  setOpenMap((m) => ({
                    ...m,
                    [g.charIdx]: !isOpen(g.charIdx),
                  }))
                }
                hideNotes={hideNotes}
                activeOnly={activeOnly}
              />
            ))
          )}

          {complete.length > 0 && (
            <div className="text-[11px] text-zinc-500 px-1 pt-1 border-t border-zinc-900">
              ✓ {complete.length} character
              {complete.length === 1 ? "" : "s"} already at cap
              {activeOnly ? " (active preset)" : " (both presets)"}:{" "}
              <span className="text-zinc-400">
                {complete.map((g) => g.charName).join(", ")}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CharSection({
  group,
  open,
  onToggle,
  hideNotes,
  activeOnly,
}: {
  group: ToMaxCharGroup;
  open: boolean;
  onToggle: () => void;
  hideNotes: boolean;
  activeOnly: boolean;
}) {
  // Count below-cap talents per preset (a talent in `items` may be missing
  // in only one preset, so the two counts can differ).
  const missingP1 = group.items.filter((it) => it.investedP1 < it.cap).length;
  const missingP2 = group.items.filter((it) => it.investedP2 < it.cap).length;
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-3 py-2.5 text-base font-semibold text-sky-300 flex items-center gap-2.5 hover:bg-white/5 rounded-t-lg ${
          open ? "border-b border-zinc-800" : ""
        }`}
        title={open ? "Collapse" : "Expand"}
      >
        <span className="w-3 text-zinc-500 select-none text-sm">
          {open ? "▾" : "▸"}
        </span>
        <span className="truncate">{group.charName}</span>
        <span className="text-[11px] text-zinc-500 font-normal">
          {group.classLabel} · Lv {group.level} · Preset{" "}
          {group.activePreset + 1} active
        </span>
        {/* Per-preset backlog summary. Active preset marked with ●. Only the
            active row shows when "active preset only" is on. */}
        <span className="ml-auto flex flex-col gap-0.5 items-end">
          {(!activeOnly || group.activePreset === 0) && (
            <PresetCount
              label="P1"
              active={group.activePreset === 0}
              missing={missingP1}
              total={group.totalScanned}
            />
          )}
          {(!activeOnly || group.activePreset === 1) && (
            <PresetCount
              label="P2"
              active={group.activePreset === 1}
              missing={missingP2}
              total={group.totalScanned}
            />
          )}
        </span>
      </button>
      {open && (
        <div>
          {group.items.map((it) => (
            <TalentRow
              key={it.talentId}
              item={it}
              activePreset={group.activePreset}
              hideNotes={hideNotes}
              activeOnly={activeOnly}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TalentRow({
  item,
  activePreset,
  hideNotes,
  activeOnly,
}: {
  item: ToMaxItem;
  activePreset: 0 | 1;
  hideNotes: boolean;
  activeOnly: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/60 last:border-b-0 hover:bg-white/5">
      <img
        src={`/talent-icons/UISkillIcon${item.talentId}.png`}
        alt={item.name}
        className="w-8 h-8 object-contain flex-shrink-0"
        style={{ imageRendering: "pixelated" }}
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-zinc-200 truncate font-medium">
            {item.name}
          </span>
          {item.accountWide && (
            <span
              className="text-[9px] leading-none px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono flex-shrink-0"
              title="Account-wide talent (🌐): the bonus comes from the highest-level char of the class"
            >
              🌐
            </span>
          )}
          <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">
            #{item.talentId}
          </span>
        </div>
        {!hideNotes && (
          <div className="text-[11px] text-zinc-500 truncate">
            {item.bonusText || item.tab}
          </div>
        )}
      </div>
      {/* Per-preset invested vs cap. Active preset marked with ●. When
          "active preset only" is on, only the active preset's column shows. */}
      <div className="flex-shrink-0 flex flex-col gap-0.5 items-end">
        {(!activeOnly || activePreset === 0) && (
          <PresetStat
            label="P1"
            active={activePreset === 0}
            invested={item.investedP1}
            cap={item.cap}
          />
        )}
        {(!activeOnly || activePreset === 1) && (
          <PresetStat
            label="P2"
            active={activePreset === 1}
            invested={item.investedP2}
            cap={item.cap}
          />
        )}
      </div>
    </div>
  );
}

// Per-preset backlog count shown in a char section header.
function PresetCount({
  label,
  active,
  missing,
  total,
}: {
  label: string;
  active: boolean;
  missing: number;
  total: number;
}) {
  const atCap = total - missing;
  const done = missing === 0;
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-normal whitespace-nowrap">
      <span
        className={`w-7 text-right ${
          active ? "text-sky-300 font-semibold" : "text-zinc-500"
        }`}
      >
        {label}
        {active ? "●" : ""}
      </span>
      {done ? (
        <span className="text-emerald-400">✓ all at cap</span>
      ) : (
        <span className="text-zinc-500">
          <span className="text-amber-300 font-semibold">{missing}</span> to go ·{" "}
          {atCap}/{total} at cap
        </span>
      )}
    </span>
  );
}

function PresetStat({
  label,
  active,
  invested,
  cap,
}: {
  label: string;
  active: boolean;
  invested: number;
  cap: number;
}) {
  const gap = Math.max(0, cap - invested);
  const atCap = gap === 0;
  return (
    <div
      className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap"
      title={
        (active ? "Active preset in-game · " : "") +
        (atCap ? "at cap" : `${gap} to go`)
      }
    >
      <span
        className={`w-7 text-right ${
          active ? "text-sky-300 font-semibold" : "text-zinc-500"
        }`}
      >
        {label}
        {active ? "●" : ""}
      </span>
      <span className="text-zinc-300">
        {invested}
        <span className="text-zinc-600">/{cap}</span>
      </span>
      <span
        className={`w-14 text-right ${atCap ? "text-emerald-400" : "text-amber-300"}`}
      >
        {atCap ? "✓ cap" : `${gap} to go`}
      </span>
    </div>
  );
}
