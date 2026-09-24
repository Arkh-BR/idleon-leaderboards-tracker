// AFK Gains Rate page: the statTracker kit's config for N.js
// AFKgainrates("Fighting") — the AFK Info panel's AFK GAINS RATE line.

import type { GainSource, GainsModel, StatPageConfig } from "@/lib/statTracker/config";
import { directChildren } from "@/lib/statTracker/biggestGains";
import { AFK_NODES, AFK_ROOT, afkRate } from "@/lib/arkh/stats/defs/afk-gains";
import { TOP_AFK_GENERATED_AT, TOP_AFK_PLAYERS_SCANNED } from "./topAfkGains.meta";

/** The AFK Info panel's number (N.js @3790178: ""+Math.floor(100*rate)+"%"),
 *  on every map — the Cove's own panel format isn't used (spec). The kit
 *  appends the "%" (StatPageConfig.unit). */
export function formatAfkGains(v: number): string {
  return Number.isFinite(v) ? String(Math.floor(100 * v)) : "—";
}

const pathOf = (name: string) => `${AFK_ROOT} / ${name}`;
const GROUPS = [AFK_NODES.pool, AFK_NODES.arcane, AFK_NODES.etc92];

/** Biggest Gains what-if (spec A3, EXP D10): the sources are G1–G3's direct
 *  children; totalFromFlat rebuilds afkRate's parts from the same paths. The
 *  map rules (R1–R3) aren't progress, so they never rank. */
export const afkGainsModel: GainsModel = {
  sources(yoursFlat, refFlat) {
    const out: GainSource[] = [];
    for (const g of GROUPS) {
      const gp = pathOf(g);
      for (const p of directChildren(gp, yoursFlat, refFlat)) {
        out.push({ path: p, group: g, source: p.slice(gp.length + 3), display: "pct" });
      }
    }
    return out;
  },
  totalFromFlat(flat) {
    const sum = (g: string) => directChildren(pathOf(g), flat).reduce((a, p) => a + (Number(flat[p]) || 0), 0);
    const rule = (name: string, dflt: number) => {
      const v = flat[pathOf(name)];
      return typeof v === "number" && Number.isFinite(v) ? v : dflt;
    };
    return afkRate({
      sum: sum(AFK_NODES.pool),
      arcane: sum(AFK_NODES.arcane),
      etc92: sum(AFK_NODES.etc92),
      clam: rule(AFK_NODES.clam, 1),
      cove: rule(AFK_NODES.cove, 0),
      type: rule(AFK_NODES.type, 1),
    });
  },
};

export const AFK_PAGE: StatPageConfig = {
  statName: "AFK Gains Rate",
  gainLabel: "AFK",
  emoji: "💤",
  calculatorTitle: "AFK Gains Calculator",
  subtitle:
    "Computes every character's fighting AFK gains rate from your save — the AFK GAINS RATE line of the in-game AFK Info panel. Select character & map. All processing local in your browser.",
  totalLabel: "AFK Gains Rate (Fighting)",
  mapTitle:
    "The map sets the Arcane map bonus (slot 2), Clamworks' ×0.2 (map 306), the Crystal Glunko Cove (map 216) and whether the map's AFK target is a fight",
  errPrefix: "AFK gains compute failed",
  storage: {
    save: "afk-gains-tracker.last-upload.v1",
    name: "afk-gains-tracker.playerName",
    snapshots: "afk-gains-tracker.v1",
    collapse: "afk-gains.snapshot-section.collapsed.v1",
    exportPrefix: "afk-gains-snapshots",
    exportLabel: "afk-gains-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeAfk").then((m) => m.computeArkhAfkGains(save, charIdx, mapIdx)),
  formatTotal: formatAfkGains,
  unit: "%",
  gains: afkGainsModel,
  loadTop: () =>
    import("./topAfkGains").then((m) => ({
      flatForClass: (classKey: string | null) => m.topAfkFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_AFK_GENERATED_AT, playersScanned: TOP_AFK_PLAYERS_SCANNED },
  methodologyNote:
    "AFK gain = how much your AFK Gains Rate would rise if this source matched the top players " +
    "(Observed Max), recomputed through the game's formula. Values are a ceiling, not a one-level step. " +
    "Each top player is measured on their best Arcane AFK map (slot 2), so that row reflects the map " +
    "choice too.",
  compareTitle: "Compare every AFK gains source against the best value observed across the top players",
  gainsTabTitle: "Rank your AFK sources by how much AFK Gains Rate matching the top players would give",
  footer:
    "AFK Gains Rate is computed locally from your save — every term of the game's fighting AFK formula, pool by pool.",
};
