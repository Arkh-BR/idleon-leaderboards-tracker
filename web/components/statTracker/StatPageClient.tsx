"use client";

import { useMemo, useState } from "react";
import StatCalculator, { type StatCalculatorState } from "@/components/statTracker/StatCalculator";
import { useStatSnapshots } from "@/components/statTracker/StatSnapshotSection";
import StatBiggestGains from "@/components/statTracker/StatBiggestGains";
import type { DeepViewExtraTab } from "@/components/dropRate/DeepView";
import { flattenTree, type FlatTree } from "@/lib/dropRate/treeFlatten";
import type { StatPageConfig, TopModule } from "@/lib/statTracker/config";

type Baseline = { flatTree: FlatTree; capturedAt: number; charName: string };

/** The reference without one group: its subtree is dropped and the root (the
 *  path's first segment) is replayed through the stat's own total — a group
 *  with ordered add/replace steps can't be divided back out. */
function stripGroup(flat: FlatTree, groupPath: string, totalFromFlat: (f: FlatTree) => number): FlatTree {
  const out: FlatTree = {};
  let removed = false;
  for (const path in flat) {
    if (path === groupPath || path.startsWith(`${groupPath} / `)) removed = true;
    else out[path] = flat[path];
  }
  if (!removed) return flat;
  out[groupPath.split(" / ")[0]] = totalFromFlat(out);
  return out;
}

export default function StatPageClient({
  config,
  extraTabs,
}: {
  config: StatPageConfig;
  /** Page-specific tabs after Biggest Gains (Coin Multi's Coin Tracker). */
  extraTabs?: (state: StatCalculatorState | null) => DeepViewExtraTab[];
}) {
  const [calcState, setCalcState] = useState<StatCalculatorState | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [compareTop, setCompareTop] = useState(false);
  const [topMod, setTopMod] = useState<TopModule | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  // config.refToggle: whether the Observed Max reference keeps that group.
  const [includeRef, setIncludeRef] = useState(true);

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
    const raw = topMod.flatForClass(classKey) as FlatTree;
    return {
      flatTree:
        config.refToggle && !includeRef
          ? stripGroup(raw, config.refToggle.groupPath, config.gains.totalFromFlat)
          : raw,
      capturedAt: Date.parse(config.topMeta.generatedAt),
      charName: `Observed Max (${config.topMeta.playersScanned} top players)`,
    };
  }, [compareTop, topMod, classKey, config, includeRef]);

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
      ...(extraTabs?.(calcState) ?? []),
    ],
    [yoursFlat, classKey, calcState, config, extraTabs]
  );

  // At the tab strip's right end, on the Tree tab — the view it changes.
  const compareToggle = (
    <label
      className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none ${
        compareTop ? "text-amber-300" : "text-zinc-300"
      }`}
      title={config.compareTitle}
    >
      <input
        type="checkbox"
        checked={compareTop}
        disabled={topLoading}
        onChange={toggleTop}
        className="accent-amber-500"
      />
      🏅 {topLoading ? "Loading…" : "Compare vs Observed Max"}
    </label>
  );

  const toolbar =
    compareTop && config.refToggle ? (
      <>
        {compareToggle}
        <label
          className="inline-flex items-center gap-1.5 sm:ml-3 text-xs text-zinc-300 cursor-pointer select-none whitespace-nowrap"
          title={config.refToggle.title}
        >
          <input
            type="checkbox"
            checked={includeRef}
            onChange={(e) => setIncludeRef(e.target.checked)}
            className="accent-amber-500"
          />
          {config.refToggle.label}
        </label>
      </>
    ) : (
      compareToggle
    );

  // History + Save snapshot in a row under the total, the history panel under that.
  const snapshots = useStatSnapshots({
    config,
    state: calcState,
    onSelectBaseline: (b) => {
      setBaseline(b);
      if (b) setCompareTop(false);
    },
    selectedBaselineAt: baseline?.capturedAt ?? null,
  });

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <StatCalculator
        config={config}
        onStateChange={setCalcState}
        compareBaseline={compareTop ? topBaseline : baseline}
        baselineHint={
          compareTop
            ? "Uncheck Compare vs Observed Max to hide it"
            : "Pick another snapshot in History to switch, or toggle it off there"
        }
        totalActions={snapshots.actions}
        totalPanel={snapshots.panel}
        extraTabs={gainsTabs}
        extraTabsFirst
        defaultView="biggest-gains"
        treeToolbar={toolbar}
      />
      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        {config.footer}
      </footer>
    </main>
  );
}
