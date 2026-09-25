"use client";

import { useMemo, useState } from "react";
import DrCalculator, {
  type CalculatorState,
} from "@/components/dropRate/DrCalculator";
import { useDrSnapshots } from "@/components/dropRate/SnapshotSection";
import BiggestGains from "@/components/dropRate/BiggestGains";
import type { DeepViewExtraTab } from "@/components/dropRate/DeepView";
import { flattenTree, type FlatTree } from "@/lib/dropRate/treeFlatten";
import {
  TOP_DR_GENERATED_AT,
  TOP_DR_PLAYERS_SCANNED,
} from "@/lib/dropRate/topDropRate.meta";

type Baseline = {
  flatTree: FlatTree;
  capturedAt: number;
  charName: string;
};

// The Arcane Map contributes a single Post-Processing multiplier. Stripping
// it lets the user see the hypothetical-max DR without the map's impact.
const ARCANE_MAP_PATH = "Drop Rate / Post-Processing / 🗺️ Arcane Map";

/** Copy of the top-DR flat map with the Arcane Map removed: its subtree is
 *  dropped and the headline DR + Post-Processing totals are divided by the
 *  map's multiplier (Post-Processing is purely multiplicative, so removing a
 *  factor is an exact divide). */
function stripArcaneMap(flat: FlatTree): FlatTree {
  const m = flat[ARCANE_MAP_PATH];
  if (!m) return { ...flat };
  const out: FlatTree = {};
  for (const path in flat) {
    if (path === ARCANE_MAP_PATH || path.startsWith(`${ARCANE_MAP_PATH} / `))
      continue;
    out[path] = flat[path];
  }
  if (typeof out["Drop Rate"] === "number") out["Drop Rate"] /= m;
  if (typeof out["Drop Rate / Post-Processing"] === "number")
    out["Drop Rate / Post-Processing"] /= m;
  return out;
}

export default function DropRatePageClient() {
  // The calculator owns the parse/compute state; the snapshot section
  // consumes it via this lifted state so the "Save snapshot" button always
  // records the currently-displayed DR (post-arcane, post-map).
  const [calcState, setCalcState] = useState<CalculatorState | null>(null);
  // When the user picks a snapshot to compare against, the detailed tree
  // gains a per-node "Δ vs snap" column. Lives at the page level so the
  // snapshots (useDrSnapshots, which owns the picker) and DrCalculator (which
  // renders the tree) can share it.
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  // Compare against the bundled top-player reference instead of a personal
  // snapshot. The (large) module is lazy-loaded the first time the toggle is
  // turned on, so it stays out of the initial route bundle.
  const [compareTop, setCompareTop] = useState(false);
  const [topMod, setTopMod] =
    useState<typeof import("@/lib/dropRate/topDropRate") | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  // Whether the hypothetical-max baseline includes the Arcane Map multiplier.
  const [includeArcaneMap, setIncludeArcaneMap] = useState(true);

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
    const raw = topMod.topDrFlatForClass(classKey) as FlatTree;
    return {
      flatTree: includeArcaneMap ? raw : stripArcaneMap(raw),
      capturedAt: Date.parse(TOP_DR_GENERATED_AT),
      charName: `Observed Max (${TOP_DR_PLAYERS_SCANNED} top players)${
        includeArcaneMap ? "" : " · no Arcane Map"
      }`,
    };
  }, [compareTop, topMod, classKey, includeArcaneMap]);

  const effectiveBaseline = compareTop ? topBaseline : baseline;

  // "💡 Biggest Gains" — ranks DR systems by the total Drop Rate gained by
  // closing the gap to the Observed Max. Reuses the same flat tree the page
  // already computes (no engine re-run) and lazy-loads the per-class top-DR
  // reference internally. Entered as a DeepView extra tab (no DeepView fork).
  const yoursFlat = useMemo<FlatTree | null>(
    () => (calcState?.drTree ? flattenTree(calcState.drTree) : null),
    [calcState?.drTree]
  );
  const biggestGainsTabs = useMemo<DeepViewExtraTab[]>(
    () => [
      {
        id: "biggest-gains",
        label: "💡 Biggest Gains",
        title:
          "Rank your Drop Rate systems by how much total DR closing the gap to the top players would give",
        render: () => (
          <BiggestGains
            yoursFlat={yoursFlat}
            classKey={classKey}
            computeError={calcState?.computeError ?? null}
          />
        ),
      },
    ],
    [yoursFlat, classKey, calcState?.computeError]
  );

  // The compare-vs-top toggle sits at the tab strip's right end (treeToolbar),
  // its Include Arcane Map option in the comparison banner while it's on
  // (baselineExtra); History + Save snapshot in a row under the Total Drop
  // Rate, the history panel under that (totalActions / totalPanel).
  const compareToggle = <TopCompareToggle active={compareTop} loading={topLoading} onToggle={toggleTop} />;
  const arcaneToggle = compareTop && (
    <label
      className="inline-flex items-center gap-1.5 text-zinc-300 cursor-pointer select-none whitespace-nowrap"
      title="Include the Arcane Map's Post-Processing multiplier in the Observed Max DR. Uncheck to see the ceiling without the map."
    >
      <input
        type="checkbox"
        checked={includeArcaneMap}
        onChange={(e) => setIncludeArcaneMap(e.target.checked)}
        className="accent-amber-500"
      />
      🗺️ Include Arcane Map
    </label>
  );
  const snapshots = useDrSnapshots({
    state: calcState,
    onSelectBaseline: (b) => {
      setBaseline(b);
      if (b) setCompareTop(false);
    },
    selectedBaselineAt: baseline?.capturedAt ?? null,
  });

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <DrCalculator
        onStateChange={setCalcState}
        compareBaseline={effectiveBaseline}
        baselineHint={
          compareTop
            ? "Uncheck Compare vs Observed Max to hide it"
            : "Pick another snapshot in History to switch, or toggle it off there"
        }
        totalActions={snapshots.actions}
        totalPanel={snapshots.panel}
        extraTabs={biggestGainsTabs}
        extraTabsFirst
        defaultView="biggest-gains"
        treeToolbar={compareToggle}
        baselineExtra={arcaneToggle}
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
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none ${
        active ? "text-amber-300" : "text-zinc-300"
      }`}
      title="Compare every DR source against the best value observed across the top players"
    >
      <input
        type="checkbox"
        checked={active}
        disabled={loading}
        onChange={onToggle}
        className="accent-amber-500"
      />
      🏅 {loading ? "Loading…" : "Compare vs Observed Max"}
    </label>
  );
}
