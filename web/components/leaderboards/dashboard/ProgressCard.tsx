import { computeDelta, netRankMovement, type LbSnapshot } from "@/lib/lbSnapshot";
import { standingsOf } from "@/lib/leaderboards/dashboard";
import type { LbPlayer } from "@/lib/leaderboards/types";
import { Panel } from "./ui";

// Full-width hero card. Positive = climbed (rank numbers went down). Green up, red down, zinc unchanged.
function NetKpi({ value }: { value: number }) {
  const color =
    value > 0
      ? "text-emerald-400 border-emerald-700/50 bg-gradient-to-br from-emerald-950/30 to-zinc-900/40"
      : value < 0
        ? "text-red-400 border-red-800/50 bg-gradient-to-br from-red-950/30 to-zinc-900/40"
        : "text-zinc-300 border-zinc-700/60 bg-gradient-to-br from-zinc-900/60 to-zinc-900/30";
  const hint = value > 0 ? "Total ranks climbed across all boards" : value < 0 ? "Total ranks dropped across all boards" : "No net change";
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <div className="text-5xl font-bold leading-none tabular-nums">{`${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`}</div>
          <div className="whitespace-nowrap text-xs uppercase tracking-wider opacity-80">Net rank movement</div>
        </div>
        <div className="max-w-md text-right text-xs opacity-70">{hint}</div>
      </div>
    </div>
  );
}

function SmallKpi({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div className={`rounded-lg border bg-zinc-900/40 p-3 ${red ? "border-red-800/40 text-red-400" : "border-emerald-800/40 text-emerald-400"}`}>
      <div className="mb-1 text-xs text-zinc-400">{label}</div>
      <div className="text-2xl font-bold leading-none tabular-nums">{value.toLocaleString("en-US")}</div>
    </div>
  );
}

/** The manual snapshot (lib/lbSnapshot): net movement since it was saved, plus the button that (re)saves it. */
export default function ProgressCard({ player, snapshot, onSave }: { player: LbPlayer; snapshot: LbSnapshot | null; onSave(): void }) {
  const save = (
    <button
      type="button"
      onClick={onSave}
      title={
        snapshot
          ? `Last saved ${new Date(snapshot.savedAt).toLocaleString("en-US")}. Click to overwrite with your current standings.`
          : "Save your current ranks and values as a baseline to track how they move."
      }
      className="rounded-md border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-900/40"
    >
      {snapshot ? "Update snapshot" : "Save snapshot"}
    </button>
  );
  if (!snapshot)
    return (
      <Panel title="Progress" action={save}>
        <p className="text-sm text-zinc-500">Save a snapshot to track how your ranks move from here.</p>
      </Panel>
    );
  const mv = netRankMovement(Object.values(computeDelta(standingsOf(player), snapshot)));
  return (
    <Panel title={`Progress since ${new Date(snapshot.savedAt).toLocaleDateString("en-US")}`} action={save}>
      <div className="space-y-3">
        <NetKpi value={mv.total} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmallKpi label="Boards climbed" value={mv.gained} />
          <SmallKpi label="Boards dropped" value={mv.lost} red />
        </div>
      </div>
    </Panel>
  );
}
