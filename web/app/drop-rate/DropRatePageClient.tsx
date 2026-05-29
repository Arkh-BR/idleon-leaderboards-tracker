"use client";

import { useMemo, useState } from "react";
import DrCalculator, {
  type CalculatorState,
} from "@/components/dropRate/DrCalculator";
import SnapshotSection from "@/components/dropRate/SnapshotSection";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import {
  TOP_DR_GENERATED_AT,
  TOP_DR_BEST,
  TOP_DR_HYPOTHETICAL_TOTAL,
  TOP_DR_PLAYERS_SCANNED,
} from "@/lib/dropRate/topDropRate.meta";

type Baseline = {
  flatTree: FlatTree;
  capturedAt: number;
  charName: string;
};

export default function DropRatePageClient() {
  // The calculator owns the parse/compute state; the snapshot section
  // consumes it via this lifted state so the "Save snapshot" button always
  // records the currently-displayed DR (post-arcane, post-map).
  const [calcState, setCalcState] = useState<CalculatorState | null>(null);
  // When the user picks a snapshot to compare against, the detailed tree
  // gains a per-node "Δ vs snap" column. Lives at the page level so the
  // SnapshotSection (which owns the picker) and DrCalculator (which renders
  // the tree) can share it.
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  // Compare against the bundled top-player reference instead of a personal
  // snapshot. The (large) module is lazy-loaded the first time the toggle is
  // turned on, so it stays out of the initial route bundle.
  const [compareTop, setCompareTop] = useState(false);
  const [topMod, setTopMod] =
    useState<typeof import("@/lib/dropRate/topDropRate") | null>(null);
  const [topLoading, setTopLoading] = useState(false);

  const toggleTop = async () => {
    if (compareTop) {
      setCompareTop(false);
      return;
    }
    if (!topMod) {
      setTopLoading(true);
      try {
        setTopMod(await import("@/lib/dropRate/topDropRate"));
      } finally {
        setTopLoading(false);
      }
    }
    setCompareTop(true);
  };

  // The reference is gated to the SELECTED char's class — class-specific DR
  // talents (Robbing Hood 279 / Curse of Mr Looty Booty 24) only appear for
  // classes that can have them. Recomputes when the char (class) changes.
  const classKey = calcState?.classKey ?? null;
  const topBaseline = useMemo<Baseline | null>(() => {
    if (!compareTop || !topMod) return null;
    return {
      flatTree: topMod.topDrFlatForClass(classKey) as FlatTree,
      capturedAt: Date.parse(TOP_DR_GENERATED_AT),
      charName: `Hypothetical max (${TOP_DR_PLAYERS_SCANNED} top players)`,
    };
  }, [compareTop, topMod, classKey]);

  const effectiveBaseline = compareTop ? topBaseline : baseline;

  // Render the snapshot section + the top-player toggle right under the Big
  // DR card (above the detailed tree) via DrCalculator's middleSlot prop.
  const snapshotBlock = (
    <div className="flex flex-col gap-3">
      <TopCompareToggle
        active={compareTop}
        loading={topLoading}
        onToggle={toggleTop}
        classTotal={
          compareTop && topBaseline
            ? topBaseline.flatTree["Drop Rate"] ?? null
            : null
        }
        className={classKey ? classKey.replace(/_/g, " ") : null}
      />
      <SnapshotSection
        state={calcState}
        onSelectBaseline={(b) => {
          setBaseline(b);
          if (b) setCompareTop(false);
        }}
        selectedBaselineAt={baseline?.capturedAt ?? null}
      />
    </div>
  );

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <DrCalculator
        onStateChange={setCalcState}
        compareBaseline={effectiveBaseline}
        middleSlot={snapshotBlock}
      />
      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Drop rate is computed locally from your save JSON — pool tree
        decomposition (LUK Scaling → Main Additive → LUK2 Additive →
        Post-Processing) matches the in-game value to within ~1%.
      </footer>
    </main>
  );
}

function TopCompareToggle({
  active,
  loading,
  onToggle,
  classTotal,
  className,
}: {
  active: boolean;
  loading: boolean;
  onToggle: () => void;
  /** Per-class ceiling for the selected char (null until a save+class is
   *  loaded and the comparison is on). Falls back to the best per-class
   *  ceiling from the metadata. */
  classTotal?: number | null;
  /** Display class name of the selected char (e.g. "Hunter"). */
  className?: string | null;
}) {
  const hypoVal = classTotal ?? TOP_DR_HYPOTHETICAL_TOTAL;
  const hypo = Math.round(hypoVal).toLocaleString("en-US");
  const best = Math.round(TOP_DR_BEST.total).toLocaleString("en-US");
  const perClass = classTotal != null && className;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className={`px-3 py-1.5 text-sm font-semibold rounded border transition-colors disabled:opacity-50 ${
          active
            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
            : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
        }`}
        title="Compare every DR source against the best value seen across the top players (the hypothetical-max save)"
      >
        🏅{" "}
        {loading
          ? "Loading…"
          : active
          ? "Comparing vs hypothetical max"
          : "Compare vs hypothetical max"}
      </button>
      <span className="text-[11px] text-zinc-500">
        Each source row gets a Δ vs the best of every top player ·{" "}
        <span title="Best-of-each-source recomputed through the DR formula. Class-specific talents (Robbing Hood / Curse of Mr Looty Booty) are gated to the selected char's class, so this ceiling is reachable by that class.">
          {perClass ? `${className} max ` : "best class max "}
          <span className="text-amber-300 font-mono">{hypo}x</span>
        </span>
        {TOP_DR_BEST.player ? (
          <>
            {" "}
            · best real player{" "}
            <span className="text-zinc-400 font-mono">{best}x</span> (
            {TOP_DR_BEST.player})
          </>
        ) : null}
      </span>
    </div>
  );
}
