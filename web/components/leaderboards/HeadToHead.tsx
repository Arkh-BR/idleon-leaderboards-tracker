"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerPicker from "./PlayerPicker";
import { Panel, Table } from "./dashboard/ui";
import { headToHead } from "@/lib/leaderboards/headToHead";
import type { LbBoard, LbMeta, LbPlayer } from "@/lib/leaderboards/types";

export const RECENT_KEY = "idleon-leaderboards.v4.recentH2H";
const RECENT_MAX = 8;

/** Newest first, case-insensitive dedupe, at most 8. */
export const addRecent = (list: string[], name: string) =>
  [name, ...list.filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, RECENT_MAX);

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

type Props = {
  me: LbPlayer;
  meta: LbMeta;
  initial?: string;
  board?: LbBoard | null; // globalRanking around me: rival and top-10 chips, no extra request
  onCompared?(name: string, them: LbPlayer): void; // must be stable (effect dependency)
};

type Result = { name: string; them?: LbPlayer; error?: string };

export default function HeadToHead({ me, meta, initial, board, onCompared }: Props) {
  const [picked, setPicked] = useState(initial?.trim() ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [section, setSection] = useState("");
  const [attempt, setAttempt] = useState(0); // re-pick of the same name after an error = retry

  useEffect(() => {
    if (!picked) return;
    let live = true;
    setRes(null);
    (async () => {
      try {
        const r = await fetch(`/api/lb/player?name=${encodeURIComponent(picked)}`);
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        if (!live) return;
        const them = body as LbPlayer;
        setRes({ name: picked, them });
        setRecent((prev) => {
          const next = addRecent(prev, picked);
          try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          } catch {
            /* storage unavailable: keep in memory */
          }
          return next;
        });
        onCompared?.(picked, them);
      } catch (e) {
        if (live) setRes({ name: picked, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      live = false;
    };
  }, [picked, attempt, onCompared]);

  // metric key → board label and its section option
  const where = useMemo(() => {
    const out = new Map<string, { label: string; sec: string; secLabel: string }>();
    for (const t of meta.tabs)
      for (const s of t.sections) for (const m of s.metrics) out.set(m.key, { label: m.label, sec: `${t.key}/${s.name}`, secLabel: `${s.name} (${t.label})` });
    return out;
  }, [meta]);

  const chips = useMemo(() => {
    const myName = me.player.mainChar.toLowerCase();
    const seen = new Set([myName]);
    const out: { label: string; name: string }[] = [];
    const add = (name: string, label: string) => {
      if (seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      out.push({ name, label });
    };
    for (const r of board?.around ?? []) add(r.mainChar, `#${r.rank} ${r.mainChar}`);
    for (const r of board?.top.slice(0, 10) ?? []) add(r.mainChar, `#${r.rank} ${r.mainChar}`);
    for (const n of recent) add(n, n);
    return out;
  }, [board, recent, me]);

  const current = res?.name === picked ? res : null;
  const h2h = useMemo(() => (current?.them ? headToHead(me, current.them) : null), [me, current]);
  const sections = useMemo(() => {
    if (!h2h) return [];
    const seen = new Map<string, string>();
    for (const row of h2h.rows) {
      const w = where.get(row.metric);
      if (w) seen.set(w.sec, w.secLabel);
    }
    return [...seen];
  }, [h2h, where]);
  const rows = h2h ? h2h.rows.filter((r) => !section || where.get(r.metric)?.sec === section) : [];
  const onPick = (name: string) => {
    setSection("");
    if (name !== picked) setPicked(name);
    else if (current?.error) setAttempt((n) => n + 1);
  };
  const rank = (r: number, won: boolean) => <span className={won ? "font-semibold text-emerald-300" : undefined}>#{r}</span>;

  return (
    <Panel title="Head-to-head">
      <PlayerPicker value={picked} onPick={onPick} chips={chips} label="Compare with" button="Compare" />
      <div className="mt-3">
        {picked && !current && <div className="text-sm text-zinc-500">Loading…</div>}
        {current?.error && (
          <div className="rounded border border-red-800 bg-red-950/50 p-3 text-sm">
            <strong className="text-red-400">Error:</strong> {current.error}
          </div>
        )}
        {h2h && current?.them && (
          <>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-zinc-300">
                vs <span className="font-semibold text-zinc-100">{current.them.player.mainChar}</span>{" "}
                <span className="text-zinc-500">(global #{current.them.player.rank})</span>:{" "}
                <span className="font-mono">{`${h2h.wins} wins · ${h2h.losses} losses · ${h2h.ties} ties`}</span>
              </p>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                Section
                <select
                  aria-label="Section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-300"
                >
                  <option value="">All sections</option>
                  {sections.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Table
              headers={["Board", "You", "Them"]}
              empty="No boards in this section."
              rows={rows.map((r) => ({
                key: r.metric,
                cells: [where.get(r.metric)?.label ?? r.metric, rank(r.a.r, r.winner === "a"), rank(r.b.r, r.winner === "b")],
              }))}
            />
          </>
        )}
      </div>
    </Panel>
  );
}
