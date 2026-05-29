"use client";

import { useState } from "react";
import DrCalculator, {
  type CalculatorState,
} from "@/components/dropRate/DrCalculator";
import SnapshotSection from "@/components/dropRate/SnapshotSection";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import {
  TOP_DR_GENERATED_AT,
  TOP_DR_BEST,
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
  // snapshot. The (large) flatTree is lazy-loaded the first time the toggle
  // is turned on, so it stays out of the initial route bundle.
  const [compareTop, setCompareTop] = useState(false);
  const [topBaseline, setTopBaseline] = useState<Baseline | null>(null);
  const [topLoading, setTopLoading] = useState(false);

  const toggleTop = async () => {
    if (compareTop) {
      setCompareTop(false);
      return;
    }
    if (!topBaseline) {
      setTopLoading(true);
      try {
        const mod = await import("@/lib/dropRate/topDropRate");
        setTopBaseline({
          flatTree: mod.TOP_DR_FLAT as FlatTree,
          capturedAt: Date.parse(TOP_DR_GENERATED_AT),
          charName: `Top players (${TOP_DR_PLAYERS_SCANNED} scanned)`,
        });
      } finally {
        setTopLoading(false);
      }
    }
    setCompareTop(true);
  };

  const effectiveBaseline = compareTop ? topBaseline : baseline;

  // Render the snapshot section + the top-player toggle right under the Big
  // DR card (above the detailed tree) via DrCalculator's middleSlot prop.
  const snapshotBlock = (
    <div className="flex flex-col gap-3">
      <TopCompareToggle
        active={compareTop}
        loading={topLoading}
        onToggle={toggleTop}
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
}: {
  active: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  const best = Math.round(TOP_DR_BEST.total).toLocaleString("en-US");
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
        title="Compare every DR source against the best value seen across the top players"
      >
        🏅{" "}
        {loading
          ? "Loading…"
          : active
          ? "Comparing vs top players"
          : "Compare vs top players"}
      </button>
      <span className="text-[11px] text-zinc-500">
        Each source row gets a Δ vs the community ceiling
        {TOP_DR_BEST.player ? (
          <>
            {" "}
            · best total{" "}
            <span className="text-amber-300 font-mono">{best}x</span> (
            {TOP_DR_BEST.player})
          </>
        ) : null}
      </span>
    </div>
  );
}
