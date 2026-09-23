"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatDistanceToNow } from "date-fns";
import GameLoginDialog from "@/components/GameLoginDialog";
import type { SaveEnvelope } from "@/lib/gameAuth/envelope";
import {
  autoUpdateMode,
  cachedEnvelope,
  checkForUpdate,
  hasSession,
  loadAccountSave,
  setAutoUpdateMode,
  signOut,
  type AutoUpdateMode,
  type Provider,
} from "@/lib/gameAuth/session";

// Loads a save for the Tome / Drop Rate / Talents / Cooking pages, either from
// the player's own game account (sign-in, auto-updating every 5 min) or from a
// public IdleonToolbox profile by name (via the /api/profile proxy). Both give
// the same envelope, so each page feeds `onSave(save)` into its pipeline.
// `meta.refresh` marks a newer copy of the account save already on screen, so
// a page can keep the user's selections instead of resetting them.
//
// On mount: account save already loaded this visit → signed in with
// auto-update not stopped → the last player name (persisted per page).
// The manual-paste fallback is passed as `children` and rendered inside.

const AUTO_UPDATE_MS = 5 * 60 * 1000;
const BTN =
  "px-2 py-1 text-xs rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50";

export default function ProfileNameLoader({
  storageKey,
  onSave,
  onError,
  children,
  rightSlot,
}: {
  storageKey: string;
  /** Called with the raw save envelope ({ data, charNames, … }) on success. */
  onSave: (save: unknown, meta?: { refresh?: boolean }) => void;
  onError?: (msg: string) => void;
  /** Manual-paste fallback, rendered inside the card below the loader. */
  children?: ReactNode;
  /** Optional control rendered to the right of the Load button (e.g. a
   *  page-specific toggle). */
  rightSlot?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const initialized = useRef(false);

  // Sign-in needs the game's Firebase key (NEXT_PUBLIC_IDLEON_*); without it
  // the site simply doesn't offer it.
  const loginEnabled = !!process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY;
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState<{ mainChar: string; lastUpdated: number } | null>(null);
  const [mode, setMode] = useState<AutoUpdateMode>("on");
  const [syncing, setSyncing] = useState(false);
  const [dialogTab, setDialogTab] = useState<Provider | null>(null);
  // Whether the page currently shows the account save (vs one loaded by name).
  const showingAccount = useRef(false);
  // Latest callbacks: pages pass inline lambdas, and the auto-update timer
  // must not restart on every render.
  const cb = useRef({ onSave, onError });
  useEffect(() => {
    cb.current = { onSave, onError };
  });

  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
    cb.current.onError?.(msg);
    if (!hasSession()) {
      setSignedIn(false);
      setAccount(null);
    }
  }, []);

  const applyAccount = useCallback((env: SaveEnvelope) => {
    setAccount({ mainChar: env.charNames[0] ?? "?", lastUpdated: env.lastUpdated });
    const refresh = showingAccount.current;
    showingAccount.current = true;
    cb.current.onSave(env, { refresh });
  }, []);

  const syncAccount = useCallback(
    async (force: boolean) => {
      setSyncing(true);
      setError(null);
      try {
        applyAccount(await loadAccountSave({ force }));
      } catch (e) {
        fail(e);
      } finally {
        setSyncing(false);
      }
    },
    [applyAccount, fail]
  );

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
        showingAccount.current = false;
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

  // Mount: account save already loaded this visit → signed in with
  // auto-update not stopped → the last player name.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const m = autoUpdateMode();
    setMode(m);
    const session = loginEnabled && hasSession();
    setSignedIn(session);
    const cached = loginEnabled ? cachedEnvelope() : null;
    if (cached) {
      applyAccount(cached);
      return;
    }
    if (session && m !== "off") {
      syncAccount(false);
      return;
    }
    let saved = "";
    try {
      saved = localStorage.getItem(storageKey) || "";
    } catch {}
    if (saved) {
      setName(saved);
      load(saved);
    }
  }, [storageKey, load, applyAccount, syncAccount, loginEnabled]);

  // Auto-update: signed in, not paused/stopped, tab visible → a cheap check
  // every 5 min; a newer save replaces the one on screen.
  useEffect(() => {
    if (!signedIn || mode !== "on") return;
    let last = Date.now();
    const tick = async () => {
      last = Date.now();
      try {
        const env = await checkForUpdate();
        if (env) applyAccount(env);
      } catch (e) {
        if (!hasSession()) fail(e); // session gone; network blips retry next tick
      }
    };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, AUTO_UPDATE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= AUTO_UPDATE_MS) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, mode, applyAccount, fail]);

  function changeMode(m: AutoUpdateMode) {
    setAutoUpdateMode(m);
    setMode(m);
    // Resume / Start: check right away instead of waiting a full cycle.
    if (m === "on") checkForUpdate().then((env) => env && applyAccount(env), fail);
  }

  function onSignedIn() {
    setDialogTab(null);
    setSignedIn(true);
    setMode(autoUpdateMode());
    showingAccount.current = false;
    syncAccount(false);
  }

  function onSignOut() {
    signOut();
    setSignedIn(false);
    setAccount(null);
    showingAccount.current = false;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(name);
  }

  return (
    <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800">
      {loginEnabled && (signedIn ? (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <span>
            ✅ <span className="font-semibold text-gold">{account?.mainChar ?? "Signed in"}</span>
          </span>
          {account && (
            <span className="text-zinc-400">
              · save updated {formatDistanceToNow(account.lastUpdated, { addSuffix: true })}
            </span>
          )}
          <span className="text-zinc-400">
            · {mode === "on" ? "auto-updating" : mode === "paused" ? "paused" : "auto-update off"}
          </span>
          {mode === "on" && (
            <button type="button" className={BTN} onClick={() => changeMode("paused")}>
              ⏸ Pause
            </button>
          )}
          {mode === "paused" && (
            <button type="button" className={BTN} onClick={() => changeMode("on")}>
              ▶ Resume
            </button>
          )}
          {mode !== "off" && (
            <button type="button" className={BTN} onClick={() => changeMode("off")}>
              ⏹ Stop
            </button>
          )}
          {mode === "off" && (
            <button type="button" className={BTN} onClick={() => changeMode("on")}>
              ▶ Start auto-update
            </button>
          )}
          <button
            type="button"
            className={BTN}
            disabled={syncing}
            onClick={() => syncAccount(true)}
          >
            {syncing ? "Syncing…" : "⟳ Sync now"}
          </button>
          <button type="button" className={BTN} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <span className="font-semibold text-gold">🔑 Sign in to load your save automatically</span>
          <button type="button" className={BTN} onClick={() => setDialogTab("google")}>
            Google
          </button>
          <button type="button" className={BTN} onClick={() => setDialogTab("steam")}>
            Steam
          </button>
        </div>
      ))}
      {loginEnabled && (
        <GameLoginDialog tab={dialogTab} onClose={() => setDialogTab(null)} onSignedIn={onSignedIn} />
      )}

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
          type="button"
          onClick={() => setWarnOpen((v) => !v)}
          aria-expanded={warnOpen}
          className="flex items-center gap-1 px-2 py-2 text-sm rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          title="Where does this data come from?"
        >
          ⚠️ <span className="text-xs">{warnOpen ? "▾" : "▸"}</span>
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        {rightSlot}
      </form>

      {warnOpen && (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          This is the player&apos;s last upload to IdleonToolbox — it may be
          older than your current in-game save. Sign in or paste manually for
          the latest.
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">⚠ {error}</p>}

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
