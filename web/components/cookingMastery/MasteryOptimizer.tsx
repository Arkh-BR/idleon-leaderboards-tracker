"use client";

import { useMemo } from "react";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import {
  readMasteryInputs,
  masteryExpReq,
} from "@/lib/arkh/stats/systems/common/cookingMastery";
import { optimize, type RoiRow } from "@/lib/cookingMastery/optimize";

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
        highlight
          ? "border-gold/40 bg-gold/5"
          : "border-zinc-800 bg-zinc-900/60"
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
      return { inp, result, error: null as string | null };
    } catch (e) {
      return {
        inp: null,
        result: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [envelope, ingameExpRate]);

  if (!computed) {
    return (
      <p className="text-sm text-zinc-500 text-center py-10">
        Carregue um save acima para ver a distribuição ótima de Purple PTS.
      </p>
    );
  }
  if (computed.error || !computed.inp || !computed.result) {
    return (
      <p className="text-sm text-red-400 py-4">
        ⚠ Não consegui ler o save: {computed.error}
      </p>
    );
  }

  const { inp, result } = computed;
  const preMastery =
    inp.rank === 0 && inp.ladles === 0 && inp.purple.every((p) => p === 0);

  // The best next point: the unlocked upgrade with the largest current ROI.
  const bestNext = result.roi.find((r) => r.unlocked && r.marginalGain > 0);

  return (
    <div className="space-y-4">
      {preMastery && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          Este save parece ser <strong>anterior ao Cooking Mastery</strong>{" "}
          (Rift 61) — rank 0 e sem pontos. Carregue um save com a mecânica
          desbloqueada para otimizar.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label="Mastery Rank"
          value={String(inp.rank)}
          sub={`EXP ${notate(inp.exp)} / ${notate(masteryExpReq(inp.rank))}`}
        />
        <Stat
          label="Purple PTS"
          value={`${result.pools.purpleAvailable} livre`}
          sub={`${result.pools.purpleSpent} / ${result.pools.purpleTotal} gasto`}
        />
        <Stat
          label="Exp/h atual"
          value={result.calibrated ? `${notate(result.current.expRate)}/h` : "informe ↑"}
          sub={
            result.calibrated
              ? "calibrado in-game"
              : `core ${notate(result.current.expRateCore)}`
          }
        />
        <Stat
          label="Exp/h ótima"
          value={
            result.calibrated
              ? `${notate(result.optimal.expRate)}/h`
              : `core ${notate(result.optimal.expRateCore)}`
          }
          sub={`+${result.gainPct.toFixed(1)}% com realocação`}
          highlight={result.gainPct > 0.05}
        />
      </div>

      {bestNext && result.pools.purpleAvailable > 0 && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
          💡 Você tem <strong>{result.pools.purpleAvailable}</strong> Purple PTS
          livre{result.pools.purpleAvailable > 1 ? "s" : ""}. O próximo rende
          mais em <strong>{bestNext.name}</strong> (+
          {bestNext.marginalGainPct.toFixed(2)}% de Exp/h).
        </div>
      )}

      {/* Allocation / ROI table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Upgrade</th>
              <th className="text-right font-medium px-3 py-2">Valor/pt</th>
              <th className="text-right font-medium px-3 py-2">Atual</th>
              <th className="text-right font-medium px-3 py-2">Ótimo</th>
              <th className="text-right font-medium px-3 py-2">ROI /pt</th>
            </tr>
          </thead>
          <tbody>
            {result.roi.map((row) => (
              <AllocRow key={row.id} row={row} best={row.id === bestNext?.id} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-zinc-500 space-y-1">
        <p>
          A Exp/h do Cooking Mastery é um <strong>produto</strong> dos upgrades
          de Purple PTS. Como cada upgrade tem rendimento decrescente, a
          alocação ótima equaliza o ganho marginal (water-filling). “Valor/pt” =
          base × coeficiente; “ROI /pt” = Exp/h ganho pelo próximo ponto na
          alocação atual.
        </p>
        <p>
          A coluna <strong>Ótimo</strong> assume reset e realocação de todos os{" "}
          {result.pools.purpleTotal} Purple PTS. Yellow PTS vão nos bônus das
          meals e não afetam a Exp/h.
          {!result.calibrated &&
            " Informe a Exp/h in-game acima para ver os valores absolutos (o ganho % já é exato)."}
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
      className={`border-t border-zinc-800/70 ${
        best ? "bg-emerald-500/5" : ""
      }`}
    >
      <td className="px-3 py-2">
        <span className={row.unlocked ? "text-zinc-200" : "text-zinc-500"}>
          {row.name}
        </span>
        {!row.unlocked && (
          <span className="ml-2 text-[11px] text-zinc-500">🔒 rank {row.rankReq}</span>
        )}
        {row.unlocked && !isExpSource && (
          <span className="ml-2 text-[11px] text-zinc-500">(não afeta Exp/h)</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
        {isExpSource ? `${row.base.toFixed(1)}×${row.coef}` : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
        {row.currentPts}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className={row.unlocked && isExpSource ? "text-zinc-100" : "text-zinc-600"}>
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
          <span className={best ? "text-emerald-300 font-semibold" : "text-zinc-300"}>
            +{row.marginalGainPct.toFixed(2)}%
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
    </tr>
  );
}
