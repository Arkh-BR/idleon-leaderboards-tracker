"use client";

import { useEffect, useState } from "react";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { computeCoinGains, splitCoinGains, type CoinGainRow } from "@/lib/coinMulti/biggestGains";

/** Compact k/M/B/T formatting for large percentages and contributions. */
function notate(n: number): string {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(a < 10 && !Number.isInteger(n) ? 2 : 0);
}

/** Gain percentages: one decimal below 10,000%, compact above. */
const fmtGain = (p: number) => (p < 1e4 ? p.toFixed(1) : notate(p));

const METHODOLOGY_NOTE =
  "Coin gain = how much your total Coin Multi would rise if this source matched the top players " +
  "(Observed Max). Every group multiplies the total, so a source's gain is its group's new factor " +
  "over the current one. Values are a ceiling, not a one-level step. The top-player reference is " +
  "measured on map 301 (World 7), so the Guild and Coins For Charon rows reflect that map choice too.";

export type LoadReference = (classKey: string | null) => Promise<Record<string, number>>;

const defaultLoadReference: LoadReference = async (classKey) => {
  const mod = await import("@/lib/coinMulti/topCoinMulti");
  return mod.topCoinFlatForClass(classKey) as Record<string, number>;
};

const Banner = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-red-400 py-4">⚠ {children}</p>
);
const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-zinc-500 text-center py-10">{children}</p>
);

function fmtContribution(row: CoinGainRow, v: number): string {
  if (row.kind === "pct") return `+${notate(v)}%`;
  return notate(v);
}

export default function CoinBiggestGains({
  yoursFlat,
  classKey,
  computeError = null,
  loadReference = defaultLoadReference,
}: {
  yoursFlat: FlatTree | null;
  classKey: string | null;
  computeError?: string | null;
  loadReference?: LoadReference;
}) {
  const [ref, setRef] = useState<Record<string, number> | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [showMinor, setShowMinor] = useState(false);

  useEffect(() => {
    if (!yoursFlat || computeError) return;
    let cancelled = false;
    setRef(null);
    setRefError(null);
    loadReference(classKey)
      .then((r) => !cancelled && setRef(r))
      .catch((e) => !cancelled && setRefError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [yoursFlat, classKey, computeError, loadReference]);

  if (computeError) return <Banner>{computeError}</Banner>;
  if (!yoursFlat) return <Hint>Load a save above to see your biggest Coin Multi gains.</Hint>;
  if (refError) return <Banner>Coin multi compute failed: {refError}</Banner>;
  if (!ref) {
    return (
      <p className="text-sm text-zinc-500 text-center py-10">
        <span className="inline-block animate-spin mr-2">⏳</span>
        Loading top-player reference…
      </p>
    );
  }

  const result = computeCoinGains(yoursFlat, ref);
  if (result.comparableSources === 0) {
    return <Hint>No comparable top-player reference for this character yet — can&apos;t rank Coin Multi gains.</Hint>;
  }
  if (result.rows.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200/90 text-center">
        🎉 You&apos;re at or above the Observed Max on every source — nothing to gain here. Nice.
      </div>
    );
  }

  const { major, minor } = splitCoinGains(result.rows);
  const visible = showMinor ? result.rows : major;

  return (
    <div className="space-y-4">
      {visible.length > 0 ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
          💡 <strong>Biggest win →</strong> improve <strong>{visible[0].source}</strong> for{" "}
          <strong>+{fmtGain(visible[0].gainPct)}%</strong> Coin Multi
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
              <th className="text-right font-medium px-3 py-2">Coin gain</th>
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
                  <span className="text-emerald-300 font-semibold">+{fmtGain(row.gainPct)}%</span>
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

      <p className="text-[11px] text-zinc-500 leading-snug">{METHODOLOGY_NOTE}</p>
    </div>
  );
}
