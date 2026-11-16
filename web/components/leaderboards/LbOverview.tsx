"use client";

import { useEffect, useState } from "react";
import { Panel } from "./dashboard/ui";
import { formatIdleon } from "@/lib/format";
import type { LbBoard, LbMeta } from "@/lib/leaderboards/types";

type Props = {
  meta: LbMeta;
  onOpenTab(key: string): void;
  player?: string | null; // loaded player's mainChar: highlighted when in the top 10
};

/** Top 10 global (no `around`: a separate, server-cached request) plus one card per meta tab. */
export default function LbOverview({ meta, onOpenTab, player }: Props) {
  const [state, setState] = useState<{ board?: LbBoard; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState(null);
    (async () => {
      try {
        const r = await fetch("/api/lb/board?metric=globalRanking");
        const b = await r.json().catch(() => ({}));
        if (!r.ok || !Array.isArray(b?.top)) throw new Error();
        if (live) setState({ board: b as LbBoard });
      } catch {
        if (live) setState({ error: "Couldn't reach Idleon Toolbox." });
      }
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  const count = (t: LbMeta["tabs"][number]) => t.sections.reduce((n, s) => n + s.metrics.length, 0);

  return (
    <div className="space-y-8">
      <Panel title="Global top 10">
        {!state && <div className="py-4 text-sm text-zinc-500">Loading…</div>}
        {state?.error && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 px-3 py-4 text-sm text-zinc-400">
            {state.error}
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-emerald-300 hover:text-emerald-200">
              Retry
            </button>
          </div>
        )}
        {state?.board && (
          <ol className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {state.board.top.slice(0, 10).map((r) => {
              const me = !!player && r.mainChar.toLowerCase() === player.toLowerCase();
              return (
                <li key={`${r.rank}:${r.mainChar}`} aria-current={me || undefined} className={`flex justify-between gap-3 px-3 py-1.5 text-sm ${me ? "bg-emerald-900/30" : ""}`}>
                  <span className="truncate text-zinc-200">
                    <span className="mr-2 font-mono text-zinc-500">#{r.rank}</span>
                    <span>{r.mainChar}</span>
                  </span>
                  <span className="font-mono text-zinc-400">{formatIdleon(r.value)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {meta.tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onOpenTab(t.key)}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-left hover:border-emerald-700"
          >
            <div className="text-sm font-semibold text-zinc-100">{t.label}</div>
            <div className="mt-0.5 text-xs text-zinc-400">{count(t)} boards ›</div>
          </button>
        ))}
      </div>
    </div>
  );
}
