// The per-stat configuration the statTracker kit (components/statTracker/*)
// renders a whole page from: copy, storage keys, the engine entry point, the
// game's number format, the Biggest Gains model and the Observed Max loader.

import type { ArkhNode } from "@/lib/dropRate/node";
import type { StatKey } from "@/lib/readings/types";
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
  /** Name of the step that replaces the whole total in `yoursFlat` (Drop Rate
   *  V2's Crystal Glunko Cove), or null. While one does, every what-if on the
   *  other sources is a no-op, so the tab says so instead of ranking. */
  replacedBy?(yoursFlat: Record<string, number>): string | null;
};

/** The generated Observed Max module (lib/<stat>/top*.ts), lazy-loaded. */
export type TopModule = { flatForClass(classKey: string | null): Record<string, number> };

export type StatPageConfig = {
  /** Stat name in copy: "Coin Multi", "EXP Multi". */
  statName: string;
  /** The in-game stat the debug "Record in-game reading" form (`?debug=1`) records on this page. */
  readingStat?: StatKey;
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
  /** Maps the selector drops (the stat has no value there). Loaded lazily: the calculator offers no map until it resolves. */
  loadMapFilter?: () => Promise<(mapIdx: number) => boolean>;
  /** The stat doesn't depend on a map: the calculator hides the map selector,
   *  labels the row "Character:", calls `compute(save, charIdx, 0)` and
   *  reports the map as "any map" (snapshot notice and history). */
  noMap?: true;
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
   *  headline, snapshot notice and history table. "": a bare number (Damage).
   *  Biggest Gains and Compare don't change. */
  unit?: "x" | "%" | "";
  /** The headline's whole text, when it isn't `formatTotal(total) + unit`
   *  (Damage prints "Min ~ Max"). Only the calculator headline; the snapshot
   *  notice and history table keep formatTotal. */
  headline?(tree: ArkhNode, total: number): string;
  /** The headline's tooltip. Default: the exponent form ("x"), or 100·total
   *  with 2 decimals for a "%" rate (AFK Gains). A stat whose total is
   *  already a percent (Multikill) passes its own. `tree` is the computed
   *  tree the total came from. */
  totalTitle?(x: number, tree?: ArkhNode | null): string;
  gains: GainsModel;
  loadTop(): Promise<TopModule>;
  topMeta: { generatedAt: string; playersScanned: number };
  methodologyNote: string;
  compareTitle: string;
  /** Optional checkbox next to Compare vs Observed Max (Drop Rate V2's Arcane
   *  Map): unchecked drops `groupPath` and its subtree from the reference and
   *  replays the root — the path's first segment — through
   *  `gains.totalFromFlat`. `groupPath` must be a direct child of the root
   *  (`<root> / <group>`): only the root is recomputed, a deeper path would
   *  leave its ancestors' values stale. Only the Compare baseline; Biggest
   *  Gains keeps the full reference. */
  refToggle?: { label: string; title: string; groupPath: string };
  gainsTabTitle: string;
  footer: string;
};
