"use client";

import { useMemo, useState } from "react";
import CoinCalculator, { type CoinCalculatorState } from "@/components/coinMulti/CoinCalculator";
import CoinSnapshotSection from "@/components/coinMulti/CoinSnapshotSection";
import CoinBiggestGains from "@/components/coinMulti/CoinBiggestGains";
import AnonExcludedNote from "@/components/AnonExcludedNote";
import type { DeepViewExtraTab } from "@/components/dropRate/DeepView";
import { flattenTree, type FlatTree } from "@/lib/dropRate/treeFlatten";
import { TOP_COIN_GENERATED_AT, TOP_COIN_PLAYERS_SCANNED } from "@/lib/coinMulti/topCoinMulti.meta";

type Baseline = { flatTree: FlatTree; capturedAt: number; charName: string };

export default function CoinMultiPageClient() {
  const [calcState, setCalcState] = useState<CoinCalculatorState | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [compareTop, setCompareTop] = useState(false);
  const [topMod, setTopMod] = useState<typeof import("@/lib/coinMulti/topCoinMulti") | null>(null);
  const [topLoading, setTopLoading] = useState(false);

  const toggleTop = async () => {
    if (compareTop) {
      setCompareTop(false);
      return;
    }
    if (!topMod) {
      setTopLoading(true);
      try {
        setTopMod(await import("@/lib/coinMulti/topCoinMulti"));
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
      flatTree: topMod.topCoinFlatForClass(classKey) as FlatTree,
      capturedAt: Date.parse(TOP_COIN_GENERATED_AT),
      charName: `Observed Max (${TOP_COIN_PLAYERS_SCANNED} top players)`,
    };
  }, [compareTop, topMod, classKey]);

  const yoursFlat = useMemo<FlatTree | null>(
    () => (calcState?.coinTree ? flattenTree(calcState.coinTree) : null),
    [calcState?.coinTree]
  );

  const gainsTabs = useMemo<DeepViewExtraTab[]>(
    () => [
      {
        id: "biggest-gains",
        label: "💡 Biggest Gains",
        title: "Rank your coin sources by how much Coin Multi matching the top players would give",
        render: () => (
          <CoinBiggestGains yoursFlat={yoursFlat} classKey={classKey} computeError={calcState?.computeError ?? null} />
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
      title="Compare every coin source against the best value observed across the top players"
    >
      🏅 {topLoading ? "Loading…" : compareTop ? "Comparing vs Observed Max" : "Compare vs Observed Max"}
    </button>
  );

  const snapshotBlock = (
    <div className="flex flex-col gap-3">
      <CoinSnapshotSection
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
      <CoinCalculator
        onStateChange={setCalcState}
        compareBaseline={compareTop ? topBaseline : baseline}
        snapshotSlot={snapshotBlock}
        extraTabs={gainsTabs}
        extraTabsFirst
        defaultView="biggest-gains"
      />
      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Coin Multi is computed locally from your save — every term of the game&apos;s coin formula, group by group.
      </footer>
    </main>
  );
}
