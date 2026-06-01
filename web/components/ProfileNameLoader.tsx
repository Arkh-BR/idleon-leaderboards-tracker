"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Load a public IdleonToolbox save by player name (via the /api/profile proxy)
// instead of pasting the ~1.3 MB JSON. Shared by the Tome / Drop Rate /
// Talents pages. The fetched object is the same envelope the paste path
// produces, so each page just feeds `onSave(save)` into its existing pipeline.
//
// The player name is persisted per page (storageKey) and auto-loaded on mount,
// mirroring the Leaderboards page. The manual-paste fallback is passed as
// `children` and rendered inside this card.
export default function ProfileNameLoader({
  storageKey,
  onSave,
  onError,
  children,
}: {
  storageKey: string;
  /** Called with the raw save envelope ({ data, charNames, … }) on success. */
  onSave: (save: unknown) => void;
  onError?: (msg: string) => void;
  /** Manual-paste fallback, rendered inside the card below the loader. */
  children?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
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
          className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[160px] font-mono"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        <button
          type="button"
          onClick={() => setWarnOpen((v) => !v)}
          aria-expanded={warnOpen}
          className="flex items-center gap-1 px-2 py-2 text-sm rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          title="Where does this data come from?"
        >
          ⚠️ <span className="text-xs">{warnOpen ? "▾" : "▸"}</span>
        </button>
      </form>

      {warnOpen && (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          This is the player&apos;s last upload to IdleonToolbox — it may be
          older than your current in-game save. Paste manually for the latest.
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">⚠ {error}</p>}

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
