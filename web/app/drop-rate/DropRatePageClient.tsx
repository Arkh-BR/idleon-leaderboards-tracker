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
        Tree structure mirrors{" "}
        <a
          href="https://github.com/Corgan/idleon-research-optimizer/blob/main/drop-rate-calc.html"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-500 hover:text-gold"
        >
          Corgan&rsquo;s drop-rate-calc
        </a>
        ; values reverse-engineered from the IdleonToolbox parser pipeline
        (validated against IT&rsquo;s /characters page).
      </footer>
    </main>
  );
}
