import type { HistoryPoint } from "@/lib/leaderboards/history";

const W = 640;
const H = 120;
const PAD = 8;

/** Polyline points for `vals`, scaled to their own min/max; `invert` puts smaller values higher. */
function line(vals: number[], invert: boolean): string {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return vals
    .map((v, i) => {
      const x = PAD + (i / (vals.length - 1)) * (W - 2 * PAD);
      const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
      const y = PAD + (invert ? t : 1 - t) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Global rank (inverted: up is better) and top-10 board count, one polyline each, no chart library. */
export default function HistoryChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2)
    return <div className="rounded-lg border border-zinc-800 px-3 py-4 text-sm italic text-zinc-500">Load this player again after the next refresh to start the history</div>;
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`History over ${points.length} visits: global rank #${first.globalRank} to #${last.globalRank}, boards in the top 10 ${first.top10} to ${last.top10}`}
      >
        <polyline points={line(points.map((p) => p.globalRank), true)} fill="none" strokeWidth="2" className="stroke-emerald-400" />
        <polyline points={line(points.map((p) => p.top10), false)} fill="none" strokeWidth="2" className="stroke-sky-400" />
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-emerald-400" />
          Global rank
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-sky-400" />
          Boards in the top 10
        </span>
      </div>
    </div>
  );
}
