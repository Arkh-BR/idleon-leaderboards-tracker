"use client";

import { useEffect, useMemo, useState } from "react";
import BoardTable, { type BoardSort } from "./BoardTable";
import LbDashboard from "./LbDashboard";
import LbOverview from "./LbOverview";
import PlayerPicker from "./PlayerPicker";
import { useLbData } from "./useLbData";
import type { LbPlayer } from "@/lib/leaderboards/types";
import { standingsOf } from "@/lib/leaderboards/dashboard";
import { loadSnapshot, saveSnapshot } from "@/lib/lbSnapshot";

function Card({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold text-zinc-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

function Cards({ player, moves, globalMove }: { player: LbPlayer; moves: Record<string, number>; globalMove: number }) {
  const rs = Object.values(player.ranks);
  const net = Object.values(moves).reduce((a, b) => a + b, 0);
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card
        label="Global rank"
        value={
          <>
            #{player.player.rank}
            {globalMove !== 0 && (
              <span className={`ml-2 text-sm ${globalMove > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {globalMove > 0 ? `▲${globalMove}` : `▼${-globalMove}`}
              </span>
            )}
          </>
        }
        sub={player.player.mainChar}
      />
      <Card label="Net moves" value={signed(net)} sub="since last visit" />
      <Card label="Top 10 boards" value={rs.filter((e) => e.r <= 10).length} />
      <Card label="Top 100 boards" value={rs.filter((e) => e.r <= 100).length} />
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-emerald-400 text-emerald-300" : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function LbPage() {
  const d = useLbData();
  const [tab, setTab] = useState("overview");
  const [sort, setSort] = useState<BoardSort>("it");
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  // Manual baseline for "Progress since", keyed on the LOADED player (never the in-flight input), read in
  // the same render the player changes so the card never diffs one player against another's snapshot.
  const [saves, setSaves] = useState(0);
  const snapshot = useMemo(() => loadSnapshot(d.loadedName), [d.loadedName, saves]); // saves: re-read after Save
  const saveCurrent = () => {
    if (!d.player || d.loading) return;
    saveSnapshot(d.loadedName, standingsOf(d.player));
    setSaves((n) => n + 1);
  };

  const boards = useMemo(
    () => d.meta.tabs.flatMap((t) => t.sections.flatMap((s) => s.metrics.map((m) => ({ m, tab: t.key })))),
    [d.meta],
  );

  // Scroll after the target tab has rendered its rows.
  useEffect(() => {
    if (!jumpTo) return;
    document.getElementById(`board-${jumpTo}`)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    setJumpTo(null);
  }, [jumpTo, tab]);

  const metaTab = d.meta.tabs.find((t) => t.key === tab);
  const count = (t: (typeof d.meta.tabs)[number]) => t.sections.reduce((n, s) => n + s.metrics.length, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="mb-1 text-2xl font-bold text-emerald-300">Idleon Toolbox Leaderboards Tracker</h1>
        <p className="text-sm text-zinc-400" suppressHydrationWarning>
          {d.meta.totalPlayers.toLocaleString("en-US")} players · updated{" "}
          {new Date(d.meta.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <PlayerPicker value={d.name} onPick={d.load} busy={d.loading} />
        <input
          list="lb-boards"
          aria-label={`Jump to a board (${boards.length})`}
          placeholder={`Jump to a board (${boards.length})`}
          onChange={(e) => {
            const hit = boards.find((b) => b.m.label === e.target.value);
            if (!hit) return;
            setTab(hit.tab);
            setJumpTo(hit.m.key);
            e.target.value = "";
          }}
          className="min-w-[200px] rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <datalist id="lb-boards">
          {boards.map((b) => (
            <option key={b.m.key} value={b.m.label} />
          ))}
        </datalist>
        <label
          className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-zinc-400"
          title="Include anonymous players in board lists. Your own rank always counts everyone."
        >
          <input type="checkbox" checked={!d.hideAnon} onChange={(e) => d.setHideAnon(!e.target.checked)} className="accent-emerald-500" />
          Show anonymous
        </label>
      </div>

      {d.error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded border border-red-800 bg-red-950/50 p-3 text-sm">
          <span>
            <strong className="text-red-400">Error:</strong> {d.error}
          </span>
          {d.canRetry && (
            <button
              type="button"
              onClick={() => d.load(d.name)}
              disabled={d.loading}
              className="rounded border border-red-700 px-2 py-0.5 text-xs text-red-200 hover:bg-red-900/40 disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {d.player && <Cards player={d.player} moves={d.moves} globalMove={d.globalMove} />}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-zinc-800">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </TabButton>
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          Dashboard
        </TabButton>
        {d.meta.tabs.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} ({count(t)})
          </TabButton>
        ))}
      </div>

      {tab === "overview" && <LbOverview meta={d.meta} onOpenTab={setTab} player={d.player?.player.mainChar} />}
      {tab === "dashboard" && (
        <LbDashboard
          meta={d.meta}
          player={d.player}
          snapshot={snapshot}
          onSaveSnapshot={saveCurrent}
          saveDisabled={d.loading}
          history={d.history}
        />
      )}
      {metaTab && (
        <>
          <div className="mb-3 flex justify-end">
            <select
              aria-label="Sort boards"
              value={sort}
              onChange={(e) => setSort(e.target.value as BoardSort)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-300"
            >
              <option value="it">IT order</option>
              <option value="closest">Closest to next rank</option>
              <option value="worst">Worst rank</option>
            </select>
          </div>
          <BoardTable tab={metaTab} player={d.player} moves={d.moves} sort={sort} hideAnon={d.hideAnon} />
        </>
      )}

      <footer className="mt-12 border-t border-zinc-900 pt-4 text-center text-xs text-zinc-600">
        Source:{" "}
        <a href="https://idleontoolbox.com" className="text-zinc-400 hover:text-emerald-300" target="_blank" rel="noreferrer">
          idleontoolbox.com
        </a>
      </footer>
    </main>
  );
}
