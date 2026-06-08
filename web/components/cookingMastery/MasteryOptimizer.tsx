"use client";

import { useMemo } from "react";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import {
  readMasteryInputs,
  masteryExpReq,
} from "@/lib/arkh/stats/systems/common/cookingMastery";
import { optimize, type RoiRow, type OptimizeResult } from "@/lib/cookingMastery/optimize";
import { expRateTree } from "@/lib/cookingMastery/tree";
import DeepView from "@/components/dropRate/DeepView";

/** Compact k/M/B/T number formatting for Exp/h and large counts. */
function notate(n: number): string {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return a < 10 && !Number.isInteger(n) ? n.toFixed(2) : String(Math.round(n));
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-gold/40 bg-gold/5" : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${highlight ? "text-gold" : "text-zinc-100"}`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

export default function MasteryOptimizer({
  envelope,
  ingameExpRate,
}: {
  envelope: unknown;
  ingameExpRate?: number;
}) {
  const computed = useMemo(() => {
    if (!envelope) return null;
    try {
      loadSaveData(envelope as never);
      const inp = readMasteryInputs(saveData);
      const result = optimize(inp, { calibrateExpRate: ingameExpRate });
      const tree = expRateTree(saveData);
      return { inp, result, tree, error: null as string | null };
    } catch (e) {
      return {
        inp: null,
        result: null,
        tree: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [envelope, ingameExpRate]);

  if (!computed) {
    return (
      <p className="text-sm text-zinc-500 text-center py-10">
        Load a save above to see the optimal Purple PTS distribution.
      </p>
    );
  }
  if (computed.error || !computed.inp || !computed.result) {
    return (
      <p className="text-sm text-red-400 py-4">
        ⚠ Couldn&apos;t read the save: {computed.error}
      </p>
    );
  }

  const { inp, result, tree } = computed;
  const preMastery =
    inp.rank === 0 && inp.ladles === 0 && inp.purple.every((p) => p === 0);
  const bestNext = result.roi.find((r) => r.id === result.bestUpgradeId);

  return (
    <div className="space-y-4">
      {preMastery && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          This save looks like it&apos;s{" "}
          <strong>from before Cooking Mastery</strong> (Rift 61) — rank 0 and no
          points. Load a save with the mechanic unlocked to optimize.
        </div>
      )}

      {/* Summary cards — always visible above the tabs (like the Total DR readout). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label="Mastery Rank"
          value={String(inp.rank)}
          sub={`EXP ${notate(inp.exp)} / ${notate(masteryExpReq(inp.rank))}`}
        />
        <Stat
          label="Purple PTS"
          value={`${result.pools.purpleAvailable} free`}
          sub={`${result.pools.purpleSpent} / ${result.pools.purpleTotal} spent`}
        />
        <Stat
          label="Current Exp/h"
          value={`${notate(result.current.expRate)}/h`}
          sub={result.calibrated ? "calibrated in-game" : "computed from save"}
        />
        <Stat
          label="Optimal Exp/h"
          value={`${notate(result.optimal.expRate)}/h`}
          sub={`+${result.gainPct.toFixed(1)}% with realloc`}
          highlight={result.gainPct > 0.05}
        />
      </div>

      {bestNext && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
          💡 <strong>Next point →</strong>{" "}
          {result.pools.purpleAvailable > 0
            ? `${result.pools.purpleAvailable} free Purple PT${
                result.pools.purpleAvailable > 1 ? "s" : ""
              } available; put the next one in `
            : "the next Purple PT you earn should go in "}
          <strong>{bestNext.name}</strong> (+
          {bestNext.marginalGainPct.toFixed(2)}% Exp/h
          {bestNext.currentPts < bestNext.optimalPts
            ? `, toward the optimal ${result.optimal.purple[bestNext.id]}`
            : ""}
          ).
        </div>
      )}

      {/* Optimizer / Tree tabs — same DeepView tab strip the Drop Rate uses
          (here with the Per-World tab off and the optimizer table as the
          extra tab, opened by default). */}
      <DeepView
        tree={tree}
        showWorldView={false}
        defaultView="optimizer"
        extraTabsFirst
        treeTabLabel="🌳 Tree"
        extraTabs={[
          {
            id: "optimizer",
            label: "🎯 Optimizer",
            title: "Optimal Purple PTS allocation + ROI per upgrade",
            render: () => <OptimizerTable result={result} />,
          },
        ]}
      />
    </div>
  );
}

function OptimizerTable({ result }: { result: OptimizeResult }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Upgrade</th>
              <th className="text-right font-medium px-3 py-2">Value/pt</th>
              <th className="text-right font-medium px-3 py-2">Current</th>
              <th className="text-right font-medium px-3 py-2">Optimal</th>
              <th className="text-right font-medium px-3 py-2">ROI /pt</th>
            </tr>
          </thead>
          <tbody>
            {result.roi.map((row) => (
              <AllocRow
                key={row.id}
                row={row}
                best={row.id === result.bestUpgradeId}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-zinc-500 space-y-1">
        <p>
          Cooking Mastery Exp/h is a <strong>product</strong> of the Purple PTS
          upgrades. Since each has diminishing returns, the optimal split
          equalizes the marginal gain (water-filling). “Value/pt” = base ×
          coefficient; “ROI /pt” = Exp/h gained by the next point at the current
          allocation.
        </p>
        <p>
          The <strong>Optimal</strong> column assumes a reset and reallocation of
          all {result.pools.purpleTotal} Purple PTS. Yellow PTS go into meal
          bonuses and don&apos;t affect Exp/h. Open the <strong>🌳 Tree</strong>{" "}
          tab for the full Exp/h breakdown.
        </p>
      </div>
    </div>
  );
}

function AllocRow({ row, best }: { row: RoiRow; best: boolean }) {
  const delta = row.optimalPts - row.currentPts;
  const isExpSource = row.id !== 3; // b=3 is "daily ribbon", not Exp/h
  return (
    <tr
      className={`border-t border-zinc-800/70 ${best ? "bg-emerald-500/5" : ""}`}
    >
      <td className="px-3 py-2">
        <span className={row.unlocked ? "text-zinc-200" : "text-zinc-500"}>
          {row.name}
        </span>
        {best && (
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
            next
          </span>
        )}
        {!row.unlocked && (
          <span className="ml-2 text-[11px] text-zinc-500">
            🔒 rank {row.rankReq}
          </span>
        )}
        {row.unlocked && !isExpSource && (
          <span className="ml-2 text-[11px] text-zinc-500">
            (doesn&apos;t affect Exp/h)
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
        {isExpSource ? `${row.base.toFixed(1)}×${row.coef}` : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
        {row.currentPts}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span
          className={row.unlocked && isExpSource ? "text-zinc-100" : "text-zinc-600"}
        >
          {row.unlocked && isExpSource ? row.optimalPts : "—"}
        </span>
        {delta !== 0 && isExpSource && row.unlocked && (
          <span
            className={`ml-1 text-[11px] ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.unlocked && isExpSource && row.marginalGainPct > 0 ? (
          <span
            className={best ? "text-emerald-300 font-semibold" : "text-zinc-300"}
          >
            +{row.marginalGainPct.toFixed(2)}%
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
    </tr>
  );
}
