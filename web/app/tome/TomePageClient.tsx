"use client";

import { useEffect, useState } from "react";
import TomeRawPanel from "@/components/tome/TomeRawPanel";
import BestTomePanel from "@/components/tome/BestTomePanel";
import BiggestGainsPanel from "@/components/tome/BiggestGainsPanel";
import AnonExcludedNote from "@/components/AnonExcludedNote";

type Tab = "gains" | "best" | "raw";

const DUNGEON_KEY = "idleon-leaderboards.tome.dungeonAsOne";

export default function TomePageClient() {
  // Biggest Gains is the default view — the prescriptive "what to push next"
  // answer leads. Best Tome is the full descriptive sheet; Raw analysis is the
  // debug view where the user pastes the JSON. All three read the same
  // localStorage key, so pasting in any tab updates the others.
  const [tab, setTab] = useState<Tab>("gains");

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
          Paste your raw save JSON from IdleonToolbox and compute the 118-task
          tome score locally. Nothing is sent to any server.
        </p>
        <AnonExcludedNote className="mt-3">
          Anonymous players are excluded — anonymous profiles have no public
          save to compute a score from.
        </AnonExcludedNote>
      </header>

      <div
        role="tablist"
        className="inline-flex gap-1 mb-6 p-1 rounded-lg bg-zinc-900/60 border border-zinc-800"
      >
        <TabButton active={tab === "gains"} onClick={() => setTab("gains")}>
          💡 Biggest Gains
        </TabButton>
        <TabButton active={tab === "best"} onClick={() => setTab("best")}>
          🏆 Best Tome
        </TabButton>
        <TabButton active={tab === "raw"} onClick={() => setTab("raw")}>
          📋 Paste your data here
        </TabButton>
      </div>

      {tab === "gains" && (
        <BiggestGainsPanel
          dungeonAsOne={dungeonAsOne}
          onToggleDungeon={toggleDungeon}
        />
      )}
      {tab === "best" && (
        <BestTomePanel
          dungeonAsOne={dungeonAsOne}
          onToggleDungeon={toggleDungeon}
        />
      )}
      {tab === "raw" && (
        <TomeRawPanel
          dungeonAsOne={dungeonAsOne}
          onToggleDungeon={toggleDungeon}
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
