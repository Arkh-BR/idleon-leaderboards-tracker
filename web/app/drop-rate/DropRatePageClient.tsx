"use client";

import { useMemo, useState } from "react";
import DrCalculator, {
  type CalculatorState,
} from "@/components/dropRate/DrCalculator";
import SnapshotSection from "@/components/dropRate/SnapshotSection";
import AnonExcludedNote from "@/components/AnonExcludedNote";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
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
      charName: `Hypothetical max (${TOP_DR_PLAYERS_SCANNED} top players)${
        includeArcaneMap ? "" : " · no Arcane Map"
      }`,
    };
  }, [compareTop, topMod, classKey, includeArcaneMap]);

  const effectiveBaseline = compareTop ? topBaseline : baseline;

  // The compare-vs-top toggle sits next to the Chip Gallery + DR value
  // (compareSlot); the snapshot history is under the import box (snapshotSlot).
  const compareBlock = (
    <TopCompareToggle
      active={compareTop}
      loading={topLoading}
      onToggle={toggleTop}
      includeArcaneMap={includeArcaneMap}
      onToggleArcaneMap={setIncludeArcaneMap}
    />
  );
  const snapshotBlock = (
    <SnapshotSection
      state={calcState}
      onSelectBaseline={(b) => {
        setBaseline(b);
        if (b) setCompareTop(false);
      }}
      selectedBaselineAt={baseline?.capturedAt ?? null}
    />
  );

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <DrCalculator
        onStateChange={setCalcState}
        compareBaseline={effectiveBaseline}
        compareSlot={compareBlock}
        snapshotSlot={snapshotBlock}
        topSlot={
          <AnonExcludedNote>
            Anonymous players are excluded from the top-player comparison —
            anonymous profiles have no public save to compute from.
          </AnonExcludedNote>
        }
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
  includeArcaneMap,
  onToggleArcaneMap,
}: {
  active: boolean;
  loading: boolean;
  onToggle: () => void;
  /** Whether the Observed-Max baseline includes the Arcane Map multiplier. */
  includeArcaneMap: boolean;
  onToggleArcaneMap: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className={`px-3 py-1.5 text-sm font-semibold rounded border transition-colors disabled:opacity-50 ${
          active
            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
            : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
        }`}
        title="Compare every DR source against the best value observed across the top players"
      >
        🏅{" "}
        {loading
          ? "Loading…"
          : active
          ? "Comparing vs Observed Max"
          : "Compare vs Observed Max"}
      </button>
      <label
        className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none"
        title="Include the Arcane Map's Post-Processing multiplier in the Observed Max DR. Uncheck to see the ceiling without the map."
      >
        <input
          type="checkbox"
          checked={includeArcaneMap}
          onChange={(e) => onToggleArcaneMap(e.target.checked)}
          className="accent-amber-500"
        />
        🗺️ Include Arcane Map
      </label>
    </div>
  );
}
