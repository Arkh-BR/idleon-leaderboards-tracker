"use client";

import { useState } from "react";
import TomeRawPanel from "@/components/tome/TomeRawPanel";
import BestTomePanel from "@/components/tome/BestTomePanel";

type Tab = "best" | "raw";

export default function TomePageClient() {
  // Best Tome is the default view (polished UI). Raw analysis is the debug
  // view where the user pastes the JSON — both read from the same
  // localStorage key, so pasting in either tab updates the other.
  const [tab, setTab] = useState<Tab>("best");

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
      </header>

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

      {tab === "best" && <BestTomePanel />}
      {tab === "raw" && <TomeRawPanel />}

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
