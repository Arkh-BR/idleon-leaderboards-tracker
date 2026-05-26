"use client";

import { useState } from "react";
import DrCalculator, {
  type CalculatorState,
} from "@/components/dropRate/DrCalculator";
import SnapshotSection from "@/components/dropRate/SnapshotSection";

export default function DropRatePageClient() {
  // The calculator owns the parse/compute state; the snapshot section
  // consumes it via this lifted state so the "Save snapshot" button always
  // records the currently-displayed DR (post-arcane, post-map).
  const [calcState, setCalcState] = useState<CalculatorState | null>(null);

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <DrCalculator onStateChange={setCalcState} />
      <SnapshotSection state={calcState} />
      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Drop rate is computed locally from your save JSON — pool tree
        decomposition (LUK Scaling → Main Additive → LUK2 Additive →
        Post-Processing) matches the in-game value to within ~1%.
      </footer>
    </main>
  );
}
