// The per-stat configuration the statTracker kit (components/statTracker/*)
// renders a whole page from: copy, storage keys, the engine entry point, the
// game's number format, the Biggest Gains model and the Observed Max loader.

import type { ArkhNode } from "@/lib/arkh/node";
import type { GainRow } from "./biggestGains";

export type StatResult = { tree: ArkhNode; total: number };

/** How a source value reads in the Biggest Gains table. */
export type GainDisplay = "pct" | "x" | "raw";

export type GainSource = { path: string; group: string; source: string; display: GainDisplay };

/** What-if engine: Biggest Gains swaps one source for the Observed Max and
 *  asks the stat for its new total. */
export type GainsModel = {
  sources(yoursFlat: Record<string, number>, refFlat: Record<string, number>): GainSource[];
  totalFromFlat(flat: Record<string, number>): number;
  /** Optional steps the model computes itself — no Observed Max — ranked
   *  with the source rows but never counted as comparable sources, e.g.
   *  Multikill's "+1 damage tier". */
  levers?(yoursFlat: Record<string, number>): GainRow[];
};

/** The generated Observed Max module (lib/<stat>/top*.ts), lazy-loaded. */
export type TopModule = { flatForClass(classKey: string | null): Record<string, number> };

export type StatPageConfig = {
  /** Stat name in copy: "Coin Multi", "EXP Multi". */
  statName: string;
  /** Short label for the gain column: "Coin" → "Coin gain". */
  gainLabel: string;
  emoji: string;
  /** Calculator heading after the emoji, e.g. "Coin Multi Calculator". */
  calculatorTitle: string;
  subtitle: string;
  /** Label next to the headline number, e.g. "Total Coin Multi". */
  totalLabel: string;
  /** Tooltip of the map selector. */
  mapTitle: string;
  /** Prefix of compute error messages, e.g. "Coin multi compute failed". */
  errPrefix: string;
  storage: {
    /** Last pasted save. */
    save: string;
    /** Player name for ProfileNameLoader. */
    name: string;
    /** Snapshot store. */
    snapshots: string;
    /** Snapshot section collapse flag. */
    collapse: string;
    /** Field an older release stored the snapshot value under (Coin: "computedCoinMulti"). */
    legacyValueKey?: string;
    /** Download name prefix, e.g. "coin-multi-snapshots". */
    exportPrefix: string;
    /** Name in the import error, e.g. "coin-multi-tracker". */
    exportLabel: string;
  };
  compute(save: unknown, charIdx: number, mapIdx: number): Promise<StatResult>;
  /** The game's own text for the headline number (without the trailing "x"). */
  formatTotal(x: number): string;
  /** Headline unit, default "x". "%": formatTotal returns the percent number
   *  (AFK Gains: ⌊100·rate⌋) and the kit prints it with "%" — calculator
   *  headline, snapshot notice and history table. Biggest Gains and Compare
   *  don't change. */
  unit?: "x" | "%";
  /** The headline's tooltip. Default: the exponent form ("x"), or 100·total
   *  with 2 decimals for a "%" rate (AFK Gains). A stat whose total is
   *  already a percent (Multikill) passes its own. */
  totalTitle?(x: number): string;
  gains: GainsModel;
  loadTop(): Promise<TopModule>;
  topMeta: { generatedAt: string; playersScanned: number };
  methodologyNote: string;
  compareTitle: string;
  gainsTabTitle: string;
  footer: string;
};
