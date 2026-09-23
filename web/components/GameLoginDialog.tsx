"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  GOOGLE_DEVICE_URL,
  exchangeSteamAssertion,
  parseSteamReturnUrl,
  requestDeviceCode,
  steamLoginUrl,
  waitForGoogleIdToken,
  type DeviceCode,
  type SteamAssertion,
} from "@/lib/gameAuth/providers";
import {
  signInWithCustomToken,
  signInWithGoogleIdToken,
  type FirebaseAuth,
} from "@/lib/gameAuth/firebase";
import { startSession, type Provider } from "@/lib/gameAuth/session";

// Sign in to the player's own Idleon account. Runs entirely in the browser,
// straight against Google / Steam / the game's servers — nothing touches ours.
export default function GameLoginDialog({
  tab,
  onClose,
  onSignedIn,
}: {
  /** Tab to open on; null = closed. */
  tab: Provider | null;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Provider>("google");
  const [keep, setKeep] = useState(true);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (tab) {
      setActive(tab);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [tab]);

  function done(auth: FirebaseAuth, provider: Provider) {
    startSession(auth, provider, keep);
    onSignedIn();
  }

  const tabClass = (t: Provider) =>
    `flex-1 px-3 py-1.5 text-sm rounded ${
      active === t ? "bg-gold text-ink font-bold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
    }`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-zinc-700 bg-zinc-900 p-5 text-zinc-200 backdrop:bg-black/60"
    >
      {/* Content only while open: unmounting stops the Google polling. */}
      {tab && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-gold">Sign in with your Idleon account</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-400 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
          <div role="tablist" className="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={active === "google"}
              className={tabClass("google")}
              onClick={() => setActive("google")}
            >
              Google
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={active === "steam"}
              className={tabClass("steam")}
              onClick={() => setActive("steam")}
            >
              Steam
            </button>
          </div>
          {active === "google" ? (
            <GoogleTab onAuth={(a) => done(a, "google")} />
          ) : (
            <SteamTab onAuth={(a) => done(a, "steam")} />
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="mt-1"
            />
            <span>
              Keep me signed in on this device
              <span className="block text-xs text-zinc-500">
                Stores a login token in this browser so your save loads on every visit. Sign out
                removes it.
              </span>
            </span>
          </label>
          <p className="text-xs text-zinc-500">
            Your login goes straight from your browser to Google/Steam and the game&apos;s servers
            — never through ours. We only read your save; we never change it.
          </p>
        </div>
      )}
    </dialog>
  );
}

function GoogleTab({ onAuth }: { onAuth: (a: FirebaseAuth) => void }) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onAuthRef = useRef(onAuth);
  useEffect(() => {
    onAuthRef.current = onAuth;
  });

  useEffect(() => {
    const ac = new AbortController();
    setCode(null);
    setError(null);
    (async () => {
      try {
        const c = await requestDeviceCode();
        if (ac.signal.aborted) return;
        setCode(c);
        const googleIdToken = await waitForGoogleIdToken(c, ac.signal);
        onAuthRef.current(await signInWithGoogleIdToken(googleIdToken));
      } catch (e) {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [attempt]);

  function copyAndOpen() {
    if (!code) return;
    navigator.clipboard?.writeText(code.userCode).catch(() => {});
    window.open(GOOGLE_DEVICE_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
        <li>Click the button below — we copy your code and open google.com/device.</li>
        <li>Enter the code and pick the Google account you play Idleon with.</li>
        <li>Come back here — we detect the approval automatically.</li>
      </ol>
      <div className="self-center rounded border border-zinc-600 px-4 py-2 font-mono text-2xl tracking-widest">
        {code ? code.userCode : "…"}
      </div>
      <button
        type="button"
        onClick={copyAndOpen}
        disabled={!code || !!error}
        className="self-center rounded bg-gold px-4 py-2 font-bold text-ink disabled:opacity-50"
      >
        Copy code &amp; open Google
      </button>
      <p className="text-xs text-zinc-500">
        Google will show <em>Legends of Idleon</em> — that&apos;s the game&apos;s own login.
      </p>
      {code && !error && <p className="text-xs text-zinc-400">Waiting for approval…</p>}
      {error && (
        <p className="text-xs text-red-400">
          ⚠ {error}{" "}
          <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}

function SteamTab({ onAuth }: { onAuth: (a: FirebaseAuth) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let assertion: SteamAssertion;
    try {
      assertion = parseSteamReturnUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setBusy(true);
    try {
      onAuth(await signInWithCustomToken(await exchangeSteamAssertion(assertion)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={logIn} className="flex flex-col gap-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
        <li>
          <button
            type="button"
            className="text-gold underline"
            onClick={() => window.open(steamLoginUrl(), "_blank", "popup")}
          >
            Sign in through Steam
          </button>{" "}
          (opens a Steam window).
        </li>
        <li>
          After signing in you land on an Idleon page. Copy its address —{" "}
          <strong>don&apos;t click its blue button</strong>.
        </li>
        <li>Paste the address here:</li>
      </ol>
      <input
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        placeholder="https://www.legendsofidleon.com/steamsso/?openid…"
        className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
      />
      <button
        type="submit"
        disabled={busy || !url.trim()}
        className="self-start rounded bg-gold px-4 py-2 font-bold text-ink disabled:opacity-50"
      >
        {busy ? "Logging in…" : "Log in"}
      </button>
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </form>
  );
}
