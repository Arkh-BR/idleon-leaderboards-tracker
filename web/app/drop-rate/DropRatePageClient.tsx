"use client";

import { useState } from "react";
import DrCalculator, {
  type CalculatorState,
} from "@/components/dropRate/DrCalculator";
import SnapshotSection from "@/components/dropRate/SnapshotSection";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

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

  // Render the snapshot section right under the Big DR card (above the
  // detailed tree) via DrCalculator's middleSlot prop, so the "Save
  // snapshot" button is one scroll away from the headline value.
  const snapshotBlock = (
    <SnapshotSection
      state={calcState}
      onSelectBaseline={setBaseline}
      selectedBaselineAt={baseline?.capturedAt ?? null}
    />
  );

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <DrCalculator
        onStateChange={setCalcState}
        compareBaseline={baseline}
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
