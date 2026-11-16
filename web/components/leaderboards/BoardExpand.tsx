"use client";

import { useEffect, useRef, useState } from "react";
import type { LbBoard } from "@/lib/leaderboards/types";
import type { Notation } from "@/lib/leaderboards/types";
import { formatMetric } from "@/lib/leaderboards/format";

type Props = {
  metric: string;
  notation: Notation;
  player: string | null;
  hideAnon: boolean;
  open?: boolean;
};

export default function BoardExpand({ metric, notation, player, hideAnon, open = true }: Props) {
  const key = `${metric}|${player ?? ""}|${hideAnon}`;
  const cache = useRef(new Map<string, LbBoard>());
  const [loaded, setLoaded] = useState<{ k: string; b: LbBoard } | null>(null);
  const data = loaded?.k === key ? loaded.b : (cache.current.get(key) ?? null);
  const [failed, setFailed] = useState(false);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const full = fullKey === key;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    if (!open || cache.current.has(key)) return;
    let live = true;
    const qs = `metric=${encodeURIComponent(metric)}${player ? `&around=${encodeURIComponent(player)}` : ""}${hideAnon ? "&public=1" : ""}`;
    fetch(`/api/lb/board?${qs}`)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok || !b || !Array.isArray(b.top)) throw new Error("bad board");
        return { ...b, around: Array.isArray(b.around) ? b.around : [] } as LbBoard;
      })
      .then((b) => {
        cache.current.set(key, b);
        if (live) setLoaded({ k: key, b });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key, metric, player, hideAnon, open, attempt]);

  const cell = "px-3 py-1";
  if (failed)
    return (
      <tr>
        <td colSpan={6} className="bg-zinc-900/40 px-3 py-3 text-sm text-zinc-300">
          Couldn&apos;t reach Idleon Toolbox.{" "}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-emerald-300 hover:bg-zinc-800"
          >
            Retry
          </button>
        </td>
      </tr>
    );
  if (!data)
    return (
      <tr>
        <td colSpan={6} className="bg-zinc-900/40 px-3 py-3 text-sm text-zinc-500">
          Loading…
        </td>
      </tr>
    );

  const onBoard = !!player && data.around.length > 0;
  const shown = full ? data.top : onBoard ? data.around : data.top.slice(0, 10);
  const me = player?.toLowerCase();
  return (
    <tr>
      <td colSpan={6} className="bg-zinc-900/40 px-3 py-3">
        {player && !onBoard && <p className="mb-2 text-sm text-zinc-400">You&apos;re not on this board yet</p>}
        <table className="w-full max-w-xl text-xs">
          <thead className="text-left text-zinc-400">
            <tr>
              <th className={`${cell} font-medium`}>Rank</th>
              <th className={`${cell} font-medium`}>Player</th>
              <th className={`${cell} text-right font-medium`}>Value</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.rank + r.mainChar}
                className={me && r.mainChar.toLowerCase() === me ? "bg-emerald-900/40 text-emerald-200" : "text-zinc-300"}
              >
                <td className={`${cell} font-mono`}>#{r.rank}</td>
                <td className={cell}>{r.mainChar}</td>
                <td className={`${cell} text-right font-mono`}>{formatMetric(r.value, notation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!full && data.top.length > shown.length && (
          <button
            type="button"
            onClick={() => setFullKey(key)}
            className="mt-2 rounded border border-zinc-700 px-2 py-1 text-xs text-emerald-300 hover:bg-zinc-800"
          >
            Full top 100
          </button>
        )}
      </td>
    </tr>
  );
}
