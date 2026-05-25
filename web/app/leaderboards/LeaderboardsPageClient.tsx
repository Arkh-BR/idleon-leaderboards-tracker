"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { LeaderboardsResponse } from "@/app/api/leaderboards/route";
import LeaderboardsTable from "@/components/LeaderboardsTable";
import Dashboard from "@/components/Dashboard";
import { formatRelativeTime } from "@/lib/format";
import {
  loadSnapshot,
  saveSnapshot as persistSnapshot,
  computeDelta,
  type LbSnapshot,
  type BoardDelta,
} from "@/lib/lbSnapshot";

type Tab = "leaderboards" | "dashboard";

const STORAGE_KEY = "idleon-leaderboards.player";

export default function LeaderboardsPageClient() {
  const [playerInput, setPlayerInput] = useState("");
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("leaderboards");
  // Per-player baseline. Re-hydrated every time activePlayer changes so
  // switching characters doesn't bleed snapshots across them.
  const [snapshot, setSnapshot] = useState<LbSnapshot | null>(null);
  const initialized = useRef(false);

  const load = useCallback(async (name: string, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/leaderboards?player=${encodeURIComponent(name)}${force ? "&force=1" : ""}`;
      const r = await fetch(url);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const json = (await r.json()) as LeaderboardsResponse;
      setData(json);
      setActivePlayer(name);
      try {
        localStorage.setItem(STORAGE_KEY, name);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let saved = "";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "";
    } catch {}
    if (saved) {
      setPlayerInput(saved);
      load(saved);
    }
  }, [load]);

  // Rehydrate the snapshot whenever the active player changes (or first
  // time data comes in). Resets to null cleanly if no snapshot exists.
  useEffect(() => {
    if (!activePlayer) {
      setSnapshot(null);
      return;
    }
    setSnapshot(loadSnapshot(activePlayer));
  }, [activePlayer]);

  function saveCurrentSnapshot() {
    if (!data || !activePlayer) return;
    setSnapshot(persistSnapshot(activePlayer, data.boards));
  }

  // Compute per-board deltas once and pass to both Table and Dashboard.
  const deltas = useMemo(() => {
    const m: Record<string, BoardDelta> = {};
    if (!data) return m;
    for (const b of data.boards) {
      m[b.apiKey] = computeDelta(
        { myRank: b.myRank, myScore: b.myScore },
        snapshot?.boards[b.apiKey]
      );
    }
    return m;
  }, [data, snapshot]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = playerInput.trim();
    if (!v) return;
    load(v);
  }

  const hasData = data && data.boards.length > 0;
  const playerFound =
    hasData && data!.boards.some((b) => b.myRank !== null);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏆</span>
          <h1 className="text-2xl font-bold text-gold">
            IdleonToolbox Leaderboards Tracker
          </h1>
        </div>
        <p className="text-zinc-400 text-sm">
          Your position across all 153 IdleonToolbox leaderboards — updates
          automatically, no spreadsheet required.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap gap-2 mb-6 items-center bg-zinc-900/50 border border-zinc-800 rounded-lg p-3"
      >
        <label className="text-sm text-zinc-400 font-medium">
          Player name
        </label>
        <input
          type="text"
          value={playerInput}
          onChange={(e) => setPlayerInput(e.target.value)}
          placeholder="Enter player name"
          className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px] font-mono"
        />
        <button
          type="submit"
          disabled={loading || !playerInput.trim()}
          className="bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        {activePlayer && (
          <button
            type="button"
            onClick={() => load(activePlayer, true)}
            disabled={loading}
            className="border border-zinc-700 rounded px-3 py-2 text-sm disabled:opacity-50"
            title="Force refresh (skip 15min cache)"
          >
            🔄
          </button>
        )}
        {hasData && (
          <button
            type="button"
            onClick={saveCurrentSnapshot}
            className="text-sm font-medium px-3 py-2 rounded-md border border-emerald-700/40 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/40 ml-auto"
            title={
              snapshot
                ? `Last saved ${new Date(snapshot.savedAt).toLocaleString()} — click to overwrite with current standings`
                : "Save current ranks + scores as a baseline. Δ columns then track how each one moves over time."
            }
          >
            💾 {snapshot ? "Update snapshot" : "Save snapshot"}
          </button>
        )}
      </form>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded p-3 mb-4 text-sm">
          <strong className="text-red-400">Error:</strong> {error}
        </div>
      )}

      {hasData && (
        <div className="flex flex-wrap gap-3 items-baseline mb-4 text-sm">
          <span className="text-zinc-400">Showing</span>
          <strong className="text-gold font-mono">{data!.player}</strong>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">
            updated {formatRelativeTime(data!.fetchedAt)}
          </span>
          {snapshot && (
            <>
              <span className="text-zinc-500">·</span>
              <span
                className="text-emerald-400 text-xs"
                title={`Snapshot saved on ${new Date(snapshot.savedAt).toLocaleString()}`}
              >
                💾 snap {new Date(snapshot.savedAt).toLocaleDateString()}
              </span>
            </>
          )}
          {!playerFound && (
            <span className="ml-auto text-yellow-400 text-xs">
              ⚠ player not found on any leaderboard — check the name
              (case-insensitive) and that the profile is Public/Anonymous in IT.
            </span>
          )}
          {data!.errors.length > 0 && (
            <span className="text-orange-400 text-xs">
              ⚠ {data!.errors.length} categor{data!.errors.length === 1 ? "y" : "ies"} failed
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-zinc-800">
        <TabButton active={tab === "leaderboards"} onClick={() => setTab("leaderboards")}>
          📋 Leaderboards
        </TabButton>
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          📊 Dashboard
        </TabButton>
      </div>

      {tab === "leaderboards" &&
        (hasData ? (
          <LeaderboardsTable boards={data!.boards} deltas={deltas} />
        ) : (
          <EmptyHint>Enter a player name above and click Load to see leaderboards.</EmptyHint>
        ))}
      {tab === "dashboard" &&
        (hasData ? (
          <Dashboard
            boards={data!.boards}
            player={data!.player}
            deltas={deltas}
            snapshotAt={snapshot?.savedAt ?? null}
          />
        ) : (
          <EmptyHint>Enter a player name above and click Load to see the dashboard.</EmptyHint>
        ))}

      <footer className="mt-12 text-xs text-zinc-600 text-center border-t border-zinc-900 pt-4">
        Source:{" "}
        <a
          href="https://idleontoolbox.com"
          className="text-zinc-400 hover:text-gold"
          target="_blank"
          rel="noreferrer"
        >
          idleontoolbox.com
        </a>{" "}
        · Original code:{" "}
        <a
          href="https://github.com/Morta1/IdleonToolbox"
          className="text-zinc-400 hover:text-gold"
          target="_blank"
          rel="noreferrer"
        >
          Morta1/IdleonToolbox
        </a>
      </footer>
    </main>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-zinc-500 text-sm py-6">{children}</div>;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
