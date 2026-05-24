"use client";

import { useState } from "react";
import TomeRawPanel from "@/components/tome/TomeRawPanel";

type Tab = "raw";

export default function TomePageClient() {
  // Only one tab for now ("Raw analysis"). When the polished views land
  // (My Tome, Compare Tome, etc.) they'll be added here.
  const [tab, setTab] = useState<Tab>("raw");

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

      <div className="flex gap-1 mb-4 border-b border-zinc-800">
        <TabButton active={tab === "raw"} onClick={() => setTab("raw")}>
          🔬 Raw analysis
        </TabButton>
      </div>

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
