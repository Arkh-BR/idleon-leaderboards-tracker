"use client";

import { useMemo, useState } from "react";
import StatCalculator, { type StatCalculatorState } from "@/components/statTracker/StatCalculator";
import StatSnapshotSection from "@/components/statTracker/StatSnapshotSection";
import StatBiggestGains from "@/components/statTracker/StatBiggestGains";
import AnonExcludedNote from "@/components/AnonExcludedNote";
import type { DeepViewExtraTab } from "@/components/dropRate/DeepView";
import { flattenTree, type FlatTree } from "@/lib/dropRate/treeFlatten";
import type { StatPageConfig, TopModule } from "@/lib/statTracker/config";

type Baseline = { flatTree: FlatTree; capturedAt: number; charName: string };

export default function StatPageClient({ config }: { config: StatPageConfig }) {
  const [calcState, setCalcState] = useState<StatCalculatorState | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [compareTop, setCompareTop] = useState(false);
  const [topMod, setTopMod] = useState<TopModule | null>(null);
  const [topLoading, setTopLoading] = useState(false);

  const toggleTop = async () => {
    if (compareTop) {
      setCompareTop(false);
      return;
    }
    if (!topMod) {
      setTopLoading(true);
      try {
        setTopMod(await config.loadTop());
      } finally {
        setTopLoading(false);
      }
    }
    setCompareTop(true);
  };

  const classKey = calcState?.classKey ?? null;
  const topBaseline = useMemo<Baseline | null>(() => {
    if (!compareTop || !topMod) return null;
    return {
      flatTree: topMod.flatForClass(classKey) as FlatTree,
      capturedAt: Date.parse(config.topMeta.generatedAt),
      charName: `Observed Max (${config.topMeta.playersScanned} top players)`,
    };
  }, [compareTop, topMod, classKey]);

  const yoursFlat = useMemo<FlatTree | null>(
    () => (calcState?.tree ? flattenTree(calcState.tree) : null),
    [calcState?.tree]
  );

  const gainsTabs = useMemo<DeepViewExtraTab[]>(
    () => [
      {
        id: "biggest-gains",
        label: "💡 Biggest Gains",
        title: config.gainsTabTitle,
        render: () => (
          <StatBiggestGains config={config} yoursFlat={yoursFlat} classKey={classKey} computeError={calcState?.computeError ?? null} />
        ),
      },
    ],
    [yoursFlat, classKey, calcState?.computeError]
  );

  const compareBlock = (
    <button
      type="button"
      onClick={toggleTop}
      disabled={topLoading}
      className={`whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors disabled:opacity-50 ${
        compareTop
          ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
          : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
      }`}
      title={config.compareTitle}
    >
      🏅 {topLoading ? "Loading…" : compareTop ? "Comparing vs Observed Max" : "Compare vs Observed Max"}
    </button>
  );

  const snapshotBlock = (
    <div className="flex flex-col gap-3">
      <StatSnapshotSection
        config={config}
        state={calcState}
        onSelectBaseline={(b) => {
          setBaseline(b);
          if (b) setCompareTop(false);
        }}
        selectedBaselineAt={baseline?.capturedAt ?? null}
        headerExtra={compareBlock}
      />
      <div className="text-center">
        <AnonExcludedNote>
          Anonymous players are excluded from the top-player comparison — anonymous profiles have no public
          save to compute from.
        </AnonExcludedNote>
      </div>
    </div>
  );

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <StatCalculator
        config={config}
        onStateChange={setCalcState}
        compareBaseline={compareTop ? topBaseline : baseline}
        snapshotSlot={snapshotBlock}
        extraTabs={gainsTabs}
        extraTabsFirst
        defaultView="biggest-gains"
      />
      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        {config.footer}
      </footer>
    </main>
  );
}
