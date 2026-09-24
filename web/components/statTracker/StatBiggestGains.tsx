"use client";

import { useEffect, useMemo, useState } from "react";
import Num from "@/components/Num";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { computeGains, splitGains, type GainRow } from "@/lib/statTracker/biggestGains";
import type { StatPageConfig } from "@/lib/statTracker/config";

export type LoadReference = (classKey: string | null) => Promise<Record<string, number>>;

const Banner = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-red-400 py-4">⚠ {children}</p>
);
const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-zinc-500 text-center py-10">{children}</p>
);

function fmtContribution(row: GainRow, v: number) {
  return row.display === "pct" ? <Num value={v} plus unit="%" /> : row.display === "x" ? <Num value={v} unit="x" /> : <Num value={v} />;
}

export default function StatBiggestGains({
  config,
  yoursFlat,
  classKey,
  computeError = null,
  loadReference,
}: {
  config: StatPageConfig;
  yoursFlat: FlatTree | null;
  classKey: string | null;
  computeError?: string | null;
  loadReference?: LoadReference;
}) {
  const [ref, setRef] = useState<Record<string, number> | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [showMinor, setShowMinor] = useState(false);

  // loadReference has no caller-supplied value in the common case (the page
  // doesn't pass one), so the default loader is memoized here rather than
  // an inline default parameter — an inline arrow gets a new identity every
  // render, which would re-fire the fetch effect below on any unrelated
  // re-render (e.g. toggling "Compare vs Observed Max" elsewhere on the page).
  const effectiveLoadReference = useMemo(
    () => loadReference ?? ((ck: string | null) => config.loadTop().then((m) => m.flatForClass(ck))),
    [loadReference, config]
  );

  useEffect(() => {
    if (!yoursFlat || computeError) return;
    let cancelled = false;
    setRef(null);
    setRefError(null);
    effectiveLoadReference(classKey)
      .then((r) => !cancelled && setRef(r))
      .catch((e) => !cancelled && setRefError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [yoursFlat, classKey, computeError, effectiveLoadReference]);

  if (computeError) return <Banner>{computeError}</Banner>;
  if (!yoursFlat) return <Hint>Load a save above to see your biggest {config.statName} gains.</Hint>;
  if (refError) return <Banner>{config.errPrefix}: {refError}</Banner>;
  if (!ref) {
    return (
      <p className="text-sm text-zinc-500 text-center py-10">
        <span className="inline-block animate-spin mr-2">⏳</span>
        Loading top-player reference…
      </p>
    );
  }

  const result = computeGains(config.gains, yoursFlat, ref);
  if (result.comparableSources === 0) {
    return <Hint>No comparable top-player reference for this character yet — can&apos;t rank {config.statName} gains.</Hint>;
  }
  if (result.rows.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200/90 text-center">
        🎉 You&apos;re at or above the Observed Max on every source — nothing to gain here. Nice.
      </div>
    );
  }

  const { major, minor } = splitGains(result.rows);
  const visible = showMinor ? result.rows : major;

  return (
    <div className="space-y-4">
      {visible.length > 0 ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
          💡 <strong>Biggest win →</strong> improve <strong>{visible[0].source}</strong> for{" "}
          <strong>
            <Num value={visible[0].gainPct} plus unit="%" />
          </strong>{" "}
          {config.statName}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
          No high-impact gains — toggle &ldquo;Show minor sources&rdquo; to see the rest.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Source</th>
              <th className="text-right font-medium px-3 py-2">You</th>
              <th className="text-right font-medium px-3 py-2">Observed Max</th>
              <th className="text-right font-medium px-3 py-2">{config.gainLabel} gain</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.path} className={`border-t border-zinc-800/70 ${i === 0 ? "bg-emerald-500/5" : ""}`}>
                <td className="px-3 py-2">
                  <div className="text-zinc-200">{row.source}</div>
                  <div className="text-[11px] text-zinc-500">{row.group}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{fmtContribution(row, row.you)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{fmtContribution(row, row.max)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <Num value={row.gainPct} plus unit="%" className="text-emerald-300 font-semibold" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showMinor}
          onChange={(e) => setShowMinor(e.target.checked)}
          className="accent-emerald-500"
          disabled={minor.length === 0}
        />
        Show minor sources
        {minor.length > 0 && <span className="text-zinc-600">({minor.length} below {"<"}0.05%)</span>}
      </label>

      <p className="text-[11px] text-zinc-500 leading-snug">{config.methodologyNote}</p>
    </div>
  );
}
