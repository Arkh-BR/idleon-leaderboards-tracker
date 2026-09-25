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
  lastCheckAt,
  loadAccountSave,
  SessionExpiredError,
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
//
// `compact` (the tracker pages) puts the card on one line: signed in, the
// status + Pause/Resume + Sync now, with the name form and paste block behind
// "Load another save" and Stop / Sign out in a ⋯ menu; signed out, sign-in
// and the name form share one row.

const AUTO_UPDATE_MS = 5 * 60 * 1000;
/** How often the timer looks at the shared clock (lastCheckAt). */
const TICK_MS = 60 * 1000;
const BTN =
  "px-2 py-1 text-xs rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50";
const MENU_ITEM =
  "block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100";

export default function ProfileNameLoader({
  storageKey,
  onSave,
  onError,
  compact = false,
  children,
}: {
  storageKey: string;
  /** Called with the raw save envelope ({ data, charNames, … }) on success. */
  onSave: (save: unknown, meta?: { refresh?: boolean }) => void;
  onError?: (msg: string) => void;
  /** One-line layout (tracker pages); see above. */
  compact?: boolean;
  /** Manual-paste fallback, rendered inside the card below the loader. */
  children?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  // Compact, signed in: the "Load another save" section and the ⋯ menu.
  const [anotherOpen, setAnotherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);

  // Sign-in needs the game's Firebase key (NEXT_PUBLIC_IDLEON_*); without it
  // the site simply doesn't offer it.
  const loginEnabled = !!process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY;
  // null until the mount effect has looked at the session (SSR / first paint).
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [account, setAccount] = useState<{ mainChar: string; lastUpdated: number } | null>(null);
  const [mode, setMode] = useState<AutoUpdateMode>("on");
  const [syncing, setSyncing] = useState(false);
  const [dialogTab, setDialogTab] = useState<Provider | null>(null);
  // Whether the page currently shows the account save (vs one loaded by name).
  const showingAccount = useRef(false);
  // Whether it shows a save loaded by name: auto-update leaves that alone.
  const showingNamed = useRef(false);
  // Set by Sign out: a load it cut short ends in SessionExpiredError, which
  // isn't news to the user.
  const signedOutByUser = useRef(false);
  // Latest callbacks: pages pass inline lambdas, and the auto-update timer
  // must not restart on every render.
  const cb = useRef({ onSave, onError });
  useEffect(() => {
    cb.current = { onSave, onError };
  });

  const fail = useCallback((e: unknown) => {
    if (e instanceof SessionExpiredError && signedOutByUser.current) return;
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
    cb.current.onError?.(msg);
    if (!hasSession()) {
      setSignedIn(false);
      setAccount(null);
    }
  }, []);

  const applyAccount = useCallback((env: SaveEnvelope) => {
    setError(null);
    setAccount({ mainChar: env.charNames[0] ?? "?", lastUpdated: env.lastUpdated });
    const refresh = showingAccount.current;
    showingAccount.current = true;
    showingNamed.current = false;
    // The cached envelope is shared by every page this visit: each gets its
    // own copy, so one that writes into `data` (computeTome does) can't
    // change it for the others.
    cb.current.onSave({ ...env, data: { ...env.data } }, { refresh });
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
        showingNamed.current = true;
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
  // once 5 min have passed since the last one. The clock lives in the session,
  // so switching pages (which remounts this) doesn't restart it. A newer save
  // — or the first one, after a failed load — goes on screen unless the page
  // shows a save loaded by name.
  useEffect(() => {
    if (!signedIn || mode !== "on") return;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckAt() < AUTO_UPDATE_MS) return;
      try {
        const env = await checkForUpdate();
        if (env && !showingNamed.current) applyAccount(env);
      } catch (e) {
        if (!hasSession()) fail(e); // session gone; network blips retry next time
      }
    };
    const id = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [signedIn, mode, applyAccount, fail]);

  // A press outside the ⋯ menu (pointerdown: iOS sends no mousedown for plain
  // taps) or Escape closes it, like the TopNav Trackers list.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const inside = menuRef.current?.contains(document.activeElement);
      setMenuOpen(false);
      if (inside) menuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function changeMode(m: AutoUpdateMode) {
    setAutoUpdateMode(m);
    setMode(m);
    // Resume / Start: check right away instead of waiting a full cycle.
    if (m === "on") checkForUpdate().then((env) => env && applyAccount(env), fail);
  }

  function onSignedIn() {
    signedOutByUser.current = false;
    setDialogTab(null);
    setSignedIn(true);
    setMode(autoUpdateMode());
    showingAccount.current = false;
    showingNamed.current = false; // signing in asks for the account save
    syncAccount(false);
  }

  function onSignOut() {
    signedOutByUser.current = true;
    signOut();
    setSignedIn(false);
    setAccount(null);
    showingAccount.current = false;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(name);
  }

  // Pieces both layouts share.
  const status = (
    <>
      <span>
        ✅ <span className="font-semibold text-gold">{account?.mainChar ?? "Signed in"}</span>
      </span>
      {account && Number.isFinite(account.lastUpdated) && (
        <span className="text-zinc-400">
          · {compact ? "updated" : "save updated"}{" "}
          {formatDistanceToNow(account.lastUpdated, { addSuffix: true })}
        </span>
      )}
      <span className="text-zinc-400">
        · {mode === "on" ? "auto-updating" : mode === "paused" ? "paused" : "auto-update off"}
      </span>
    </>
  );
  // Exactly one shows: Pause (on), Resume (paused), Start (off).
  const modeButton =
    mode === "on" ? (
      <button type="button" className={BTN} onClick={() => changeMode("paused")}>
        ⏸ Pause
      </button>
    ) : mode === "paused" ? (
      <button type="button" className={BTN} onClick={() => changeMode("on")}>
        ▶ Resume
      </button>
    ) : (
      <button type="button" className={BTN} onClick={() => changeMode("on")}>
        ▶ Start auto-update
      </button>
    );
  const syncButton = (
    <button
      type="button"
      className={BTN}
      disabled={syncing}
      onClick={() => syncAccount(true)}
    >
      {syncing ? "Syncing…" : "⟳ Sync now"}
    </button>
  );
  const signInButtons = (
    <>
      <button type="button" className={BTN} onClick={() => setDialogTab("google")}>
        Google
      </button>
      <button type="button" className={BTN} onClick={() => setDialogTab("steam")}>
        Steam
      </button>
    </>
  );
  const dialog = loginEnabled && (
    <GameLoginDialog tab={dialogTab} onClose={() => setDialogTab(null)} onSignedIn={onSignedIn} />
  );
  const nameForm = (lead: ReactNode, className: string) => (
    <form onSubmit={onSubmit} className={className}>
      {lead}
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
    </form>
  );
  const warnBox = warnOpen && (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
      This is the player&apos;s last upload to IdleonToolbox — it may be
      older than your current in-game save. Sign in or paste manually for
      the latest.
    </div>
  );
  const errorLine = error && <p className="text-xs text-red-400 mt-2">⚠ {error}</p>;

  if (compact) {
    // Until the mount effect has looked up the session (SSR / first paint): a
    // neutral row as tall as the signed-in one, so a signed-in user's card
    // doesn't collapse under them on load. Nothing to look up without login.
    const pending = loginEnabled && signedIn === null;
    const showAccount = loginEnabled && signedIn === true;
    // The name form + paste block: in view signed out, behind "Load another
    // save" signed in. Hidden rather than unmounted, so a collapse keeps a
    // paste (`hidden` is display: none — not focusable, not announced; its
    // wrappers carry no display class that would override it).
    const formHidden = pending || (showAccount && !anotherOpen);
    return (
      <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {pending ? (
            <>
              <span className="text-zinc-500">Loading…</span>
              {/* Height strut: the signed-in row's buttons set its height. */}
              <span aria-hidden className={`${BTN} invisible`}>
                ⋯
              </span>
            </>
          ) : showAccount ? (
            <>
              {status}
              {/* Right-aligned even when it wraps (phones), so the ⋯ menu,
                  anchored to its button's right edge, opens on screen. */}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {modeButton}
                {syncButton}
                <button
                  type="button"
                  onClick={() => setAnotherOpen((v) => !v)}
                  aria-expanded={anotherOpen}
                  className="text-xs text-gold hover:underline"
                >
                  Load another save {anotherOpen ? "▴" : "▾"}
                </button>
                {/* Tabbing out closes the menu. A blur with no new target is a
                    pointer press (Safari doesn't focus clicked buttons): the
                    pointerdown listener handles those, like TopNav's list. */}
                <div
                  ref={menuRef}
                  className="relative"
                  onBlur={(e) => {
                    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
                  }}
                >
                  <button
                    ref={menuButtonRef}
                    type="button"
                    className={BTN}
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-expanded={menuOpen}
                    aria-label="More account actions"
                    title="More account actions"
                  >
                    ⋯
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-lg shadow-black/40">
                      {mode !== "off" && (
                        <button
                          type="button"
                          className={MENU_ITEM}
                          onClick={() => {
                            setMenuOpen(false);
                            changeMode("off");
                            // The item leaves with the menu: keep focus on ⋯.
                            menuButtonRef.current?.focus();
                          }}
                        >
                          Stop auto-sync
                        </button>
                      )}
                      <button
                        type="button"
                        className={MENU_ITEM}
                        onClick={() => {
                          setMenuOpen(false);
                          onSignOut();
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {loginEnabled && (
                <>
                  <span className="font-semibold text-gold">🔑 Sign in</span>
                  {signInButtons}
                </>
              )}
              {nameForm(
                <span className="text-zinc-400">{loginEnabled ? "or 👤" : "👤"}</span>,
                "flex flex-1 flex-wrap items-center gap-2"
              )}
            </>
          )}
        </div>
        <div hidden={formHidden}>
          {showAccount &&
            nameForm(<span className="text-zinc-400">👤</span>, "mt-3 flex flex-wrap items-center gap-2")}
          {warnBox}
        </div>
        {dialog}
        {errorLine}
        {children && (
          <div hidden={formHidden} className="mt-3">
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800">
      {loginEnabled && (signedIn ? (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          {status}
          {modeButton}
          {mode !== "off" && (
            <button type="button" className={BTN} onClick={() => changeMode("off")}>
              ⏹ Stop
            </button>
          )}
          {syncButton}
          <button type="button" className={BTN} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <span className="font-semibold text-gold">🔑 Sign in to load your save automatically</span>
          {signInButtons}
        </div>
      ))}
      {dialog}

      {nameForm(
        <span className="font-semibold text-gold">👤 Load by player name</span>,
        "flex flex-wrap gap-2 items-center"
      )}

      {warnBox}

      {errorLine}

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
