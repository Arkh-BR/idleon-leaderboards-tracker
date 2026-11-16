"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LbMeta, LbPlayer } from "@/lib/leaderboards/types";
import { liveOrSnapshotMeta } from "@/lib/leaderboards/meta";
import { appendHistory, sinceLastVisit, type HistoryPoint } from "@/lib/leaderboards/history";

const PLAYER_KEY = "idleon-leaderboards.player";
const HIDE_ANON_KEY = "idleon-leaderboards.hideAnon";

type Since = { moves: Record<string, number>; globalMove: number };
const NO_SINCE: Since = { moves: {}, globalMove: 0 };

const UNREACHABLE = "Couldn't reach Idleon Toolbox.";
// `retry`: a transient failure (IT down or the network), worth a Retry button.
const fail = (message: string, retry = false) => Object.assign(new Error(message), { retry });
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isPlayer = (x: unknown): x is LbPlayer => isObj(x) && isObj(x.ranks) && isObj(x.player);

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: skip */
  }
}

/** Page state: meta (live, else the daily snapshot's copy), the loaded player and their since-last-visit moves. */
export function useLbData() {
  const [meta, setMeta] = useState<LbMeta>(() => liveOrSnapshotMeta(null));
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<LbPlayer | null>(null);
  const [loadedName, setLoadedName] = useState(""); // name `player` was loaded under; `name` is the in-flight input
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hideAnon, setHideAnonState] = useState(false);
  const [since, setSince] = useState<Since>(NO_SINCE);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const seq = useRef(0); // only the latest load may write state

  const load = useCallback(async (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    const id = ++seq.current;
    setName(n);
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const r = await fetch(`/api/lb/player?name=${encodeURIComponent(n)}`).catch(() => null);
      const body: unknown = r ? await r.json().catch(() => ({})) : null;
      if (id !== seq.current) return;
      if (!r || r.status === 502) throw fail(UNREACHABLE, true);
      if (!r.ok) throw fail((isObj(body) && typeof body.error === "string" && body.error) || `HTTP ${r.status}`); // 404/429: the route's text
      if (!isPlayer(body)) throw fail("Unexpected response from Idleon Toolbox.");
      const p = body;
      const { moves, globalMove } = sinceLastVisit(n, p);
      setPlayer(p);
      setLoadedName(n);
      setSince({ moves, globalMove });
      setHistory(appendHistory(n, p));
      store(PLAYER_KEY, n);
    } catch (e) {
      if (id !== seq.current) return;
      setPlayer(null);
      setLoadedName("");
      setSince(NO_SINCE);
      setHistory([]);
      setError(e instanceof Error ? e.message : String(e));
      setCanRetry(!!(e as { retry?: boolean }).retry);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  const setHideAnon = useCallback((v: boolean) => {
    setHideAnonState(v);
    store(HIDE_ANON_KEY, v ? "1" : "0");
  }, []);

  useEffect(() => {
    fetch("/api/lb/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: LbMeta | null) => setMeta(liveOrSnapshotMeta(j)))
      .catch(() => {}); // keep the snapshot's meta
    let saved = "";
    try {
      saved = localStorage.getItem(PLAYER_KEY) || "";
      setHideAnonState(localStorage.getItem(HIDE_ANON_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
    if (saved) load(saved);
  }, [load]);

  return { meta, name, loadedName, player, error, canRetry, loading, load, hideAnon, setHideAnon, moves: since.moves, globalMove: since.globalMove, history };
}
