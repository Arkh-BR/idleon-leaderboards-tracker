"use client";

import { useState } from "react";
import ProfileNameLoader from "@/components/ProfileNameLoader";
import MasteryOptimizer from "@/components/cookingMastery/MasteryOptimizer";

export default function CookingMasteryPageClient() {
  const [envelope, setEnvelope] = useState<unknown>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  function applyPaste() {
    try {
      const parsed = JSON.parse(pasteText);
      setEnvelope(parsed);
      setPasteError(null);
    } catch {
      setPasteError(
        "Invalid JSON. Paste the IdleonToolbox export (Copy Data for Support) or the raw save.",
      );
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <header className="py-4">
        <h1 className="text-2xl font-bold text-gold">🍳 Cooking Mastery Optimizer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Distribute your <strong>Purple PTS</strong> to maximize Cooking Mastery
          Exp/h (unlocked at Rift 61). Everything is computed locally in your
          browser.
        </p>
      </header>

      <ProfileNameLoader
        storageKey="cooking-mastery.playerName"
        onSave={(save) => {
          setEnvelope(save);
          setPasteError(null);
        }}
        onError={(msg) => setPasteError(msg)}
      >
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
            …or paste JSON manually
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your save JSON here (Copy Data for Support on IdleonToolbox)"
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={applyPaste}
              disabled={!pasteText.trim()}
              className="self-start bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              Calculate
            </button>
          </div>
        </details>
      </ProfileNameLoader>

      {pasteError && <p className="text-xs text-red-400 mb-3">⚠ {pasteError}</p>}

      <MasteryOptimizer envelope={envelope} />

      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Exp/h ports the game&apos;s <code>ExpRateCook</code> formula (Rift 61). The
        optimal allocation uses greedy water-filling — exact for the
        multiplicative product of the upgrades.
      </footer>
    </main>
  );
}
