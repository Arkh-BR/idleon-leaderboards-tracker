"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { LeaderboardsResponse } from "@/app/api/leaderboards/route";
import LeaderboardsTable from "@/components/LeaderboardsTable";
import Dashboard from "@/components/Dashboard";
import { formatRelativeTime } from "@/lib/format";

type Tab = "leaderboards" | "dashboard";

const STORAGE_KEY = "idleon-leaderboards.player";

export default function Home() {
  const [playerInput, setPlayerInput] = useState("");
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("leaderboards");
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
            Idleon Leaderboards Tracker
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
          placeholder="e.g. ARKHE"
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
      </form>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded p-3 mb-4 text-sm">
          <strong className="text-red-400">Error:</strong> {error}
        </div>
      )}

      {hasData && (
        <>
          <div className="flex flex-wrap gap-3 items-baseline mb-4 text-sm">
            <span className="text-zinc-400">Showing</span>
            <strong className="text-gold font-mono">{data!.player}</strong>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400">
              updated {formatRelativeTime(data!.fetchedAt)}
            </span>
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

          <div className="flex gap-1 mb-4 border-b border-zinc-800">
            <TabButton active={tab === "leaderboards"} onClick={() => setTab("leaderboards")}>
              📋 Leaderboards
            </TabButton>
            <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              📊 Dashboard
            </TabButton>
          </div>

          {tab === "leaderboards" && <LeaderboardsTable boards={data!.boards} />}
          {tab === "dashboard" && <Dashboard boards={data!.boards} player={data!.player} />}
        </>
      )}

      {!hasData && !loading && !error && (
        <div className="text-zinc-500 text-sm">
          Enter a player name above and click Load.
        </div>
      )}

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
