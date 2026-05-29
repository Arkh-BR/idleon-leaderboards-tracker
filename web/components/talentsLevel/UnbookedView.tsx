"use client";

// ============================================================================
// UnbookedView — "Unbooked" tab for the Talents Level page.
//
// Renders the account-wide scan from lib/talentsLevel/unbooked.ts: one
// collapsible section per character, listing the regular talents whose cap
// (SkillLevelsMAX) is still below the maxBookLv ceiling — talents that can
// still have their cap raised by applying more talent books. Each row shows
// "current cap → max cap" plus the number of book levels still needed.
//
// Carries its own controls bar (mirrors DeepView's): search, expand /
// collapse / reset of the char sections and a "show notes" toggle (off by
// default). No
// preset toggle — the cap (SM) is a single per-char value.
//
// Pure presentation — all the math lives in computeUnbooked().
// ============================================================================

import { useMemo, useState } from "react";
import type { UnbookedCharGroup, UnbookedItem } from "@/lib/talentsLevel/unbooked";

export default function UnbookedView({
  groups,
  loading,
}: {
  groups: UnbookedCharGroup[] | null;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  // charIdx → open. Missing key defaults to closed (collapsed by default).
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({});

  const q = search.trim().toLowerCase();

  const pending = useMemo(
    () => (groups ? groups.filter((g) => g.items.length > 0) : []),
    [groups]
  );
  const complete = useMemo(
    () => (groups ? groups.filter((g) => g.items.length === 0) : []),
    [groups]
  );
  const totalBooks = useMemo(
    () => pending.reduce((a, g) => a + g.items.length, 0),
    [pending]
  );

  const matchItem = (it: UnbookedItem) =>
    !q ||
    it.name.toLowerCase().includes(q) ||
    it.tab.toLowerCase().includes(q) ||
    it.bonusText.toLowerCase().includes(q) ||
    String(it.talentId).includes(q.replace("#", ""));

  const visible = useMemo(() => {
    if (!q) return pending;
    const out: UnbookedCharGroup[] = [];
    for (const g of pending) {
      const charMatch =
        g.charName.toLowerCase().includes(q) ||
        g.classLabel.toLowerCase().includes(q);
      const items = charMatch ? g.items : g.items.filter(matchItem);
      if (items.length > 0) out.push(charMatch ? g : { ...g, items });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, q]);

  const isOpen = (charIdx: number) => openMap[charIdx] ?? false;
  const setAll = (open: boolean) =>
    setOpenMap(Object.fromEntries(pending.map((g) => [g.charIdx, open])));

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
            checked={showNotes}
            onChange={(e) => setShowNotes(e.target.checked)}
            className="accent-sky-500"
          />
          Show notes
        </label>
      </div>

      {totalBooks === 0 ? (
        <p className="text-sm text-emerald-300 px-2 py-2">
          🎉 Every talent (tab 1-5) is fully booked — all caps are at the Max
          Book Lv ceiling.
        </p>
      ) : (
        <>
          {/* Overall summary (ignores the search term). */}
          <div className="text-xs text-zinc-400 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <span className="text-gold font-semibold">{totalBooks}</span>{" "}
              talent{totalBooks === 1 ? "" : "s"} can still be booked across{" "}
              <span className="text-zinc-200 font-semibold">
                {pending.length}
              </span>{" "}
              character{pending.length === 1 ? "" : "s"}.
            </span>
            <span className="text-[11px] text-zinc-500">
              cap follows current → max book lv
            </span>
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
                showNotes={showNotes}
              />
            ))
          )}

          {complete.length > 0 && (
            <div className="text-[11px] text-zinc-500 px-1 pt-1 border-t border-zinc-900">
              ✓ {complete.length} character
              {complete.length === 1 ? "" : "s"} fully booked:{" "}
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
  showNotes,
}: {
  group: UnbookedCharGroup;
  open: boolean;
  onToggle: () => void;
  showNotes: boolean;
}) {
  const booked = group.totalScanned - group.items.length;
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
          {group.classLabel} · Lv {group.level}
        </span>
        <span className="ml-auto text-[11px] text-zinc-500 font-normal">
          <span className="text-amber-300 font-semibold">
            {group.items.length}
          </span>{" "}
          unbooked · {booked}/{group.totalScanned} booked
        </span>
      </button>
      {open && (
        <div>
          {group.items.map((it) => (
            <TalentRow key={it.talentId} item={it} showNotes={showNotes} />
          ))}
        </div>
      )}
    </section>
  );
}

function TalentRow({
  item,
  showNotes,
}: {
  item: UnbookedItem;
  showNotes: boolean;
}) {
  const pct =
    item.maxCap > 0
      ? Math.max(0, Math.min(100, (item.currentCap / item.maxCap) * 100))
      : 0;
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
        {showNotes && (
          <div className="text-[11px] text-zinc-500 truncate">
            {item.bonusText || item.tab}
          </div>
        )}
        {/* Current cap vs max-book ceiling. */}
        <div className="mt-1 h-1 w-full max-w-[220px] rounded bg-zinc-800 overflow-hidden">
          <div className="h-full bg-amber-500/60" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-sm tabular-nums text-zinc-300">
          {item.currentCap}
          <span className="text-zinc-600"> → {item.maxCap}</span>
        </div>
        <div
          className="text-[11px] font-mono text-amber-300"
          title="Levels still needed to reach the Max Book Lv ceiling"
        >
          {item.booksNeeded} level{item.booksNeeded === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
