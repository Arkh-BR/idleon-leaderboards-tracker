"use client";

import { useCallback, useMemo, useState } from "react";
import { Top100 } from "./BoardTable";
import HistoryChart from "./HistoryChart";
import HeadToHead from "./HeadToHead";
import Rivals from "./Rivals";
import ProgressCard from "./dashboard/ProgressCard";
import { Panel, Table } from "./dashboard/ui";
import type { LbSnapshot } from "@/lib/lbSnapshot";
import type { HistoryPoint } from "@/lib/leaderboards/history";
import type { LbBoard, LbMeta, LbPlayer } from "@/lib/leaderboards/types";
import { headToHead } from "@/lib/leaderboards/headToHead";
import { formatGap, formatMetric } from "@/lib/leaderboards/format";
import { sectionStrength } from "@/lib/leaderboards/sections";
import { rankBgClass, TIER_COLORS } from "@/lib/rank";
import {
  bestPositions,
  boardRows,
  cheapestClimbs,
  cutoffGaps,
  inSection,
  maxedMissing,
  tierCounts,
  worstPositions,
  type SectionKey,
} from "@/lib/leaderboards/dashboard";

type Props = {
  meta: LbMeta;
  player: LbPlayer | null;
  moves: Record<string, number>; // Task 9/10 sections
  snapshot: LbSnapshot | null;
  onSaveSnapshot(): void;
  saveDisabled?: boolean; // a new player is loading
  history: HistoryPoint[]; // Task 10 history chart
};

// Old dashboard's tier colors, one per band of TIER_BANDS.
const BAND_COLORS = [TIER_COLORS.top10, TIER_COLORS.top11_50, TIER_COLORS.top51_100, TIER_COLORS.rank201_500, TIER_COLORS.rank500plus];

const pct = (p: number) => `${p.toFixed(2)}%`;

export default function LbDashboard({ meta, player, snapshot, onSaveSnapshot, saveDisabled, history }: Props) {
  const [filter, setFilter] = useState<SectionKey | null>(null);
  const [cutoffRank, setCutoffRank] = useState<10 | 100>(100);
  const rows = useMemo(() => (player ? boardRows(meta, player.ranks) : []), [meta, player]);
  const strength = useMemo(() => (player ? sectionStrength(player.ranks, meta) : []), [meta, player]);
  const [globalBoard, setGlobalBoard] = useState<LbBoard | null>(null); // Rivals' response, reused for H2H chips
  const [compare, setCompare] = useState<{ name: string; n: number } | null>(null); // n remounts H2H on every rival click
  const [compared, setCompared] = useState<Record<string, LbPlayer>>({}); // lowercased name → their ranks
  const onCompared = useCallback((name: string, them: LbPlayer) => setCompared((c) => ({ ...c, [name.toLowerCase()]: them })), []);
  // "beats you on N": only rivals already compared (no request per rival); recomputed against the current player.
  const beats = useMemo(
    () => (player ? Object.fromEntries(Object.entries(compared).map(([k, them]) => [k, headToHead(player, them).losses])) : {}),
    [player, compared],
  );

  if (!player) return <div className="py-10 text-center text-sm text-zinc-500">Load a player to see your dashboard</div>;

  const filtered = inSection(rows, filter);
  const tabLabel = (key: string) => meta.tabs.find((t) => t.key === key)?.label ?? key;
  const isOn = (s: SectionKey) => filter?.tab === s.tab && filter.section === s.section;

  return (
    <div className="space-y-8">
      <ProgressCard player={player} snapshot={snapshot} onSave={onSaveSnapshot} disabled={saveDisabled} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Tier summary">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {tierCounts(rows).map((b, i) => (
              <div key={b.label} className={`rounded p-3 text-center ${BAND_COLORS[i]}`}>
                <div className="text-xs font-medium opacity-80">{b.label}</div>
                <div className="text-2xl font-bold tabular-nums">{b.count}</div>
                <div className="text-xs tabular-nums opacity-70">{rows.length ? ((b.count / rows.length) * 100).toFixed(1) : "0.0"}%</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Strength by section"
          action={
            filter && (
              <button type="button" onClick={() => setFilter(null)} className="text-xs text-emerald-300 hover:text-emerald-200">
                Showing {filter.section} · clear
              </button>
            )
          }
        >
          <div className="grid max-h-64 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
            {strength.map((s) => (
              <button
                key={`${s.tab}/${s.section}`}
                type="button"
                aria-pressed={isOn(s)}
                onClick={() => setFilter(isOn(s) ? null : { tab: s.tab, section: s.section })}
                className={`flex items-baseline justify-between gap-2 rounded border px-2 py-1 text-left text-sm ${
                  isOn(s) ? "border-emerald-600 bg-emerald-900/30" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
                }`}
              >
                <span className="truncate text-zinc-200">
                  {s.section} <span className="text-xs text-zinc-500">{tabLabel(s.tab)}</span>
                </span>
                <span className="whitespace-nowrap font-mono text-xs text-zinc-400" title={`Median top % over ${s.boards} boards`}>
                  {pct(s.medianTopPct)}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Worst positions">
        <Table
          headers={["Board", "Section", "Rank", "Top %", "To top 100"]}
          empty="No boards in this section."
          rows={worstPositions(filtered).map(({ m, e, section }) => ({
            key: m.key,
            cells: [m.label, <span key="s" className="font-sans text-zinc-400">{section}</span>, `#${e.r} / ${m.players.toLocaleString("en-US")}`, pct(e.p), <Top100 key="t" m={m} e={e} />],
          }))}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Cheapest climbs">
          <Table
            headers={["Board", "Rank", "Need", "To pass"]}
            empty="No climbs with a known gap."
            rows={cheapestClimbs(filtered).map(({ row: { m, e }, toRank }) => ({
              key: m.key,
              cells: [m.label, `#${e.r}`, formatGap(e.v, e.nv!, m.notation), `#${toRank}`],
            }))}
          />
        </Panel>

        <Panel
          title="Points to reach the top 100"
          action={
            <div className="flex rounded border border-zinc-700 text-xs">
              {([100, 10] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cutoffRank === c}
                  onClick={() => setCutoffRank(c)}
                  className={`px-2 py-1 ${cutoffRank === c ? "bg-emerald-700/40 text-emerald-200" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  Top {c}
                </button>
              ))}
            </div>
          }
        >
          <Table
            headers={["Board", "Need", `#${cutoffRank} has`]}
            empty={`You're in the top ${cutoffRank} everywhere, or the gaps arrive with the next daily refresh.`}
            rows={cutoffGaps(filtered, cutoffRank).map(({ row: { m, e }, cutoff }) => ({
              key: m.key,
              cells: [m.label, formatGap(e.v, cutoff, m.notation), formatMetric(cutoff, m.notation)],
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Maxed boards you're missing">
          <Table
            headers={["Board", "You", "Cap", "At cap"]}
            empty="You're at the cap on every maxed board."
            rows={maxedMissing(rows).map(({ m, e }) => ({
              key: m.key,
              cells: [m.label, formatMetric(e.v, m.notation), formatMetric(m.top, m.notation), m.topTies.toLocaleString("en-US")],
            }))}
          />
        </Panel>

        <Panel title="Your best positions">
          <Table
            headers={["Board", "Rank", "Top %"]}
            empty="No ranked boards."
            rows={bestPositions(rows).map(({ m, e }) => ({
              key: m.key,
              cells: [m.label, <span key="r" className={`inline-block min-w-[2.5rem] rounded px-2 py-0.5 text-center text-xs ${rankBgClass(e.r)}`}>#{e.r}</span>, pct(e.p)],
            }))}
          />
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Rivals
          player={player.player.mainChar}
          onBoard={setGlobalBoard}
          beats={beats}
          onCompare={(name) => {
            setCompare((c) => ({ name, n: (c?.n ?? 0) + 1 }));
            document.getElementById("lb-h2h")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
          }}
        />
        <div id="lb-h2h" className="min-w-0">
          <HeadToHead key={compare?.n ?? 0} me={player} meta={meta} initial={compare?.name} board={globalBoard} onCompared={onCompared} />
        </div>
      </div>
      <Panel title="Your history">
        <HistoryChart points={history} />
      </Panel>
    </div>
  );
}
