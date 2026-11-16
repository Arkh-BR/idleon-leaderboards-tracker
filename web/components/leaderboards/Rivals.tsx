"use client";

import { useEffect, useState } from "react";
import { Panel } from "./dashboard/ui";
import { formatIdleon } from "@/lib/format";
import type { LbBoard } from "@/lib/leaderboards/types";

type Props = {
  player: string; // mainChar, as the board rows name it
  onCompare(name: string): void;
  onBoard?(b: LbBoard | null): void; // shares the response (top-10 chips); must be stable (effect dependency)
  beats?: Record<string, number>; // lowercased name → boards they beat you on, known only after a comparison
};

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatIdleon(Math.abs(n))}`;

/** The ±5 players around you on `globalRanking` (one request per player); click one to compare. */
export default function Rivals({ player, onCompare, onBoard, beats = {} }: Props) {
  const [state, setState] = useState<{ key: string; board?: LbBoard; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    onBoard?.(null);
    (async () => {
      try {
        const r = await fetch(`/api/lb/board?metric=globalRanking&around=${encodeURIComponent(player)}`);
        const b = await r.json().catch(() => ({}));
        if (!r.ok || !Array.isArray(b?.top)) throw new Error(b?.error || "Couldn't reach Idleon Toolbox.");
        const board: LbBoard = { ...b, around: Array.isArray(b.around) ? b.around : [] };
        if (!live) return;
        setState({ key: player, board });
        onBoard?.(board);
      } catch (e) {
        if (live) setState({ key: player, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      live = false;
    };
  }, [player, attempt, onBoard]);

  const cur = state?.key === player ? state : null;
  const me = player.toLowerCase();
  const mine = cur?.board?.around.find((r) => r.mainChar.toLowerCase() === me);
  const rivals = cur?.board?.around.filter((r) => r.mainChar.toLowerCase() !== me) ?? [];

  return (
    <Panel
      title="Global rivals"
      action={mine && <span className="font-mono text-xs text-zinc-400">You: #{mine.rank} · {formatIdleon(mine.value)} pts</span>}
    >
      {!cur && <div className="text-sm text-zinc-500">Loading…</div>}
      {cur?.error && (
        <div className="rounded border border-red-800 bg-red-950/50 p-3 text-sm text-zinc-300">
          {cur.error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-emerald-300 hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      )}
      {cur?.board && !mine && <div className="text-sm italic text-zinc-500">You&apos;re not on the global ranking yet.</div>}
      {mine && (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
          {rivals.map((r) => {
            const n = beats[r.mainChar.toLowerCase()];
            return (
              <li key={r.rank + r.mainChar}>
                <button
                  type="button"
                  onClick={() => onCompare(r.mainChar)}
                  title={`Compare with ${r.mainChar}`}
                  className="flex w-full items-baseline gap-3 bg-zinc-950 px-3 py-2 text-left text-sm hover:bg-zinc-900"
                >
                  <span className="w-14 font-mono text-zinc-400">#{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-100">
                    {r.mainChar}
                    {n !== undefined && <span className="ml-2 text-xs text-zinc-500">beats you on {n}</span>}
                  </span>
                  <span className={`font-mono ${r.value > mine.value ? "text-red-300" : "text-emerald-300"}`}>{signed(r.value - mine.value)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
