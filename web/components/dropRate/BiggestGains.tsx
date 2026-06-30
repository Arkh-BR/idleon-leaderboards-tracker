"use client";

import { useEffect, useState } from "react";
import AnonExcludedNote from "@/components/AnonExcludedNote";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import {
  computeBiggestGains,
  splitByThreshold,
  type GainRow,
} from "@/lib/dropRate/biggestGains";

/** Compact k/M/B/T number formatting (mirrors the Cooking Mastery optimizer). */
function notate(n: number): string {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return a < 10 && !Number.isInteger(n) ? n.toFixed(2) : String(Math.round(n));
}

const METHODOLOGY_NOTE =
  "DR gain = how much your total Drop Rate would rise if this system matched " +
  "the top players (Observed Max). Additive systems all share the same " +
  "sensitivity, so they rank by raw gap; multipliers rank by ratio. Values " +
  "are a ceiling, not a one-level step.";

/** Loads the per-class Observed-Max reference. Injectable for tests; the
 *  default lazy-imports the (large) top-DR module just like the page's
 *  "Compare vs Observed Max" toggle does. */
export type LoadReference = (
  classKey: string | null
) => Promise<Record<string, number>>;

const defaultLoadReference: LoadReference = async (classKey) => {
  const mod = await import("@/lib/dropRate/topDropRate");
  return mod.topDrFlatForClass(classKey) as Record<string, number>;
};

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-red-400 py-4">⚠ {children}</p>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-zinc-500 text-center py-10">{children}</p>
  );
}

/** Format a system's contribution for the You / Observed Max columns. */
function fmtContribution(row: GainRow, value: number): string {
  return row.type === "additive"
    ? `+${notate(value)}pp`
    : `${value.toFixed(2)}×`;
}

export default function BiggestGains({
  yoursFlat,
  classKey,
  anonymous = false,
  computeError = null,
  loadReference = defaultLoadReference,
}: {
  /** The player's flat DR tree (`flattenTree`), or null when no save loaded. */
  yoursFlat: FlatTree | null;
  /** PascalCase class key of the selected char (picks the class reference). */
  classKey: string | null;
  /** Anonymous profile — no public save to benchmark against. */
  anonymous?: boolean;
  /** Compute error bubbled from the calculator (already prefixed). */
  computeError?: string | null;
  loadReference?: LoadReference;
}) {
  const [ref, setRef] = useState<Record<string, number> | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [showMinor, setShowMinor] = useState(false);

  // Lazy-load the Observed-Max reference once a save is present. Re-runs when
  // the selected char's class changes (the reference is class-gated).
  useEffect(() => {
    if (!yoursFlat || anonymous || computeError) return;
    let cancelled = false;
    setLoadingRef(true);
    setRefError(null);
    loadReference(classKey)
      .then((r) => {
        if (!cancelled) {
          setRef(r);
          setLoadingRef(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRefError(e instanceof Error ? e.message : String(e));
          setLoadingRef(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [yoursFlat, classKey, anonymous, computeError, loadReference]);

  if (computeError) {
    return <Banner>{computeError}</Banner>;
  }
  if (!yoursFlat) {
    return <Hint>Load a save above to see your biggest Drop Rate gains.</Hint>;
  }
  if (anonymous) {
    return (
      <div className="text-center py-6">
        <AnonExcludedNote>
          Anonymous players are excluded from the top-player comparison —
          there&apos;s no public save to benchmark against.
        </AnonExcludedNote>
      </div>
    );
  }
  if (refError) {
    return <Banner>Drop rate compute failed: {refError}</Banner>;
  }
  if (loadingRef || !ref) {
    return (
      <p className="text-sm text-zinc-500 text-center py-10">
        <span className="inline-block animate-spin mr-2">⏳</span>
        Loading top-player reference…
      </p>
    );
  }

  let result;
  try {
    result = computeBiggestGains(yoursFlat, ref);
  } catch (e) {
    return (
      <Banner>
        Drop rate compute failed: {e instanceof Error ? e.message : String(e)}
      </Banner>
    );
  }

  if (result.comparableSystems === 0) {
    return (
      <Hint>
        No comparable top-player reference for this character yet — can&apos;t
        rank Drop Rate gains.
      </Hint>
    );
  }
  if (result.rows.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200/90 text-center">
        🎉 You&apos;re at or above the Observed Max on every system — nothing to
        gain here. Nice.
      </div>
    );
  }

  const { major, minor } = splitByThreshold(result.rows);
  const visible = showMinor ? result.rows : major;
  const hasMinor = minor.length > 0;

  return (
    <div className="space-y-4">
      {visible.length > 0 ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
          💡 <strong>Biggest win →</strong> improve{" "}
          <strong>{visible[0].system}</strong> for{" "}
          <strong>+{Math.round(visible[0].drGainPct)}%</strong> Drop Rate
        </div>
      ) : (
        <div className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
          No high-impact gains — toggle &ldquo;Show minor sources&rdquo; to see
          the rest.
        </div>
      )}

      <GainsTable rows={visible} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showMinor}
            onChange={(e) => setShowMinor(e.target.checked)}
            className="accent-emerald-500"
            disabled={!hasMinor && visible.length > 0}
          />
          Show minor sources
          {hasMinor && (
            <span className="text-zinc-600">
              ({minor.length} below {"<"}0.05%)
            </span>
          )}
        </label>
      </div>

      <p className="text-[11px] text-zinc-500 leading-snug">{METHODOLOGY_NOTE}</p>
    </div>
  );
}

function GainsTable({ rows }: { rows: GainRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            <th className="text-left font-medium px-3 py-2">System</th>
            <th className="text-left font-medium px-3 py-2">Type</th>
            <th className="text-right font-medium px-3 py-2">You</th>
            <th className="text-right font-medium px-3 py-2">Observed Max</th>
            <th className="text-right font-medium px-3 py-2">DR gain</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <GainRowView key={row.path} row={row} best={i === 0} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GainRowView({ row, best }: { row: GainRow; best: boolean }) {
  return (
    <tr className={`border-t border-zinc-800/70 ${best ? "bg-emerald-500/5" : ""}`}>
      <td className="px-3 py-2">
        <span className="text-zinc-200">{row.system}</span>
        {best && (
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
            biggest win
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border ${
            row.type === "multiplier"
              ? "text-sky-300 bg-sky-500/15 border-sky-500/30"
              : "text-violet-300 bg-violet-500/15 border-violet-500/30"
          }`}
        >
          {row.type === "multiplier" ? "Multiplier" : "Additive"}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
        {fmtContribution(row, row.you)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
        {fmtContribution(row, row.max)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className="text-emerald-300 font-semibold">
          +{row.drGainPct.toFixed(1)}%
        </span>
      </td>
    </tr>
  );
}
