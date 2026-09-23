"use client";

import { useEffect, useState } from "react";
import TomeRawPanel from "@/components/tome/TomeRawPanel";
import BestTomePanel from "@/components/tome/BestTomePanel";
import AnonExcludedNote from "@/components/AnonExcludedNote";
import ProfileNameLoader from "@/components/ProfileNameLoader";
import { TOME_TASKS } from "@/lib/tome/tasks";

type Tab = "best" | "raw";

const DUNGEON_KEY = "idleon-leaderboards.tome.dungeonAsOne";
const STORAGE_KEY = "idleon-leaderboards.tome.rawJson";
const NAME_KEY = "idleon-leaderboards.tome.playerName";

export default function TomePageClient() {
  // Best Tome is the default view (polished UI). Raw analysis is the debug
  // view where the user pastes the JSON — both read from the same
  // localStorage key, so pasting in either tab updates the other.
  const [tab, setTab] = useState<Tab>("best");

  // The latest save — from the loader above the tabs (account or player
  // name) or pasted in the Raw tab. Both tabs apply it without remounting.
  const [loaded, setLoaded] = useState<unknown>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Persisted like a paste, so the Best Tome tab hydrates it on the next visit.
  function onSave(save: unknown) {
    setLoadError(null);
    setLoaded(save);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // quota exceeded — non-fatal
    }
  }

  // "Count Dungeon Rank as 1" toggle. Owned by the page (not a tab panel) so
  // it survives tab switches, and persisted so it stays on across reloads
  // until the user turns it off. Both panels apply it to their computation.
  const [dungeonAsOne, setDungeonAsOne] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(DUNGEON_KEY) === "1") setDungeonAsOne(true);
    } catch {}
  }, []);
  const toggleDungeon = () =>
    setDungeonAsOne((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DUNGEON_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📖</span>
          <h1 className="text-2xl font-bold text-gold">Tome Score Tracker</h1>
        </div>
        <p className="text-zinc-400 text-sm">
          Paste your raw save JSON from IdleonToolbox and compute the{" "}
          {TOME_TASKS.length}-task tome score locally. Nothing is sent to any
          server.
        </p>
        <AnonExcludedNote className="mt-3">
          Anonymous players are excluded — anonymous profiles have no public
          save to compute a score from.
        </AnonExcludedNote>
      </header>

      {/* One loader for both tabs, so the default Best Tome tab gets the save. */}
      <ProfileNameLoader
        storageKey={NAME_KEY}
        onSave={onSave}
        onError={setLoadError}
        rightSlot={
          <button
            type="button"
            onClick={toggleDungeon}
            aria-pressed={dungeonAsOne}
            title="Score the Dungeon Rank tome line as 1 — ignores dungeon progress in the total."
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold rounded border transition-colors ${
              dungeonAsOne
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
            }`}
          >
            🏰 Dungeon = 1{dungeonAsOne ? " ✓" : ""}
          </button>
        }
      />
      {loadError && (
        <div className="mb-4 bg-red-950/50 border border-red-800 rounded p-3 text-sm">
          <strong className="text-red-400">Error:</strong> {loadError}
        </div>
      )}

      <div
        role="tablist"
        className="inline-flex gap-1 mb-6 p-1 rounded-lg bg-zinc-900/60 border border-zinc-800"
      >
        <TabButton active={tab === "best"} onClick={() => setTab("best")}>
          🏆 Best Tome
        </TabButton>
        <TabButton active={tab === "raw"} onClick={() => setTab("raw")}>
          📋 Paste your data here
        </TabButton>
      </div>

      {tab === "best" && (
        <BestTomePanel
          loaded={loaded}
          dungeonAsOne={dungeonAsOne}
          onToggleDungeon={toggleDungeon}
        />
      )}
      {tab === "raw" && (
        <TomeRawPanel
          loaded={loaded}
          onPasted={setLoaded}
          dungeonAsOne={dungeonAsOne}
        />
      )}

      <footer className="mt-12 text-xs text-zinc-600 text-center border-t border-zinc-900 pt-4">
        Algorithm ported from the v7.9 Tome Raw Values Extractor (Apps Script).
        Source code:{" "}
        <a
          href="https://github.com/Arkh-BR/idleon-leaderboards-tracker"
          className="text-zinc-400 hover:text-gold"
          target="_blank"
          rel="noreferrer"
        >
          Arkh-BR/idleon-leaderboards-tracker
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
        active
          ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(255,215,0,0.35)]"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
      }`}
    >
      {children}
    </button>
  );
}
