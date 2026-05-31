"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Load a public IdleonToolbox save by player name (via the /api/profile proxy)
// instead of pasting the ~1.3 MB JSON. Shared by the Tome / Drop Rate /
// Talents pages. The fetched object is the same envelope the paste path
// produces, so each page just feeds `onSave(save)` into its existing pipeline.
//
// The player name is persisted per page (storageKey) and auto-loaded on mount,
// mirroring the Leaderboards page. Paste stays available as a fallback (private
// profiles aren't reachable by name).
export default function ProfileNameLoader({
  storageKey,
  onSave,
  onError,
}: {
  storageKey: string;
  /** Called with the raw save envelope ({ data, charNames, … }) on success. */
  onSave: (save: unknown) => void;
  onError?: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const load = useCallback(
    async (raw: string) => {
      const player = raw.trim();
      if (!player) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `/api/profile?player=${encodeURIComponent(player)}`
        );
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            (body && body.error) || `Failed to load (HTTP ${r.status})`
          );
        }
        try {
          localStorage.setItem(storageKey, player);
        } catch {}
        onSave(body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    },
    [onSave, onError, storageKey]
  );

  // Auto-load the last player on mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let saved = "";
    try {
      saved = localStorage.getItem(storageKey) || "";
    } catch {}
    if (saved) {
      setName(saved);
      load(saved);
    }
  }, [storageKey, load]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(name);
  }

  return (
    <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-center">
        <span className="font-semibold text-gold">👤 Load by player name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter player name"
          className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[180px] font-mono"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </form>
      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
        <span aria-hidden className="leading-tight text-sm">
          ⚠️
        </span>
        <span className="leading-snug">
          This loads the save the player last{" "}
          <strong>uploaded to IdleonToolbox</strong> (the same data that feeds
          the leaderboards) — it can be{" "}
          <strong>older than your current in-game save</strong>. For the most
          up-to-date numbers, paste your &ldquo;Copy for Support&rdquo; manually
          below. The profile must be Public or Anonymous on IT.
        </span>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">⚠ {error}</p>}
    </div>
  );
}
