// Damage page: the statTracker kit's config for N.js _customBlock_DamageDealed
// — the Damage line of the Player Info panel (Min ~ Max, Min = Max × Mastery).
// The headline total is Max; Min comes from the tree's Mastery node.

import type { StatPageConfig } from "@/lib/statTracker/config";
import type { ArkhNode } from "@/lib/arkh/node";
import { DMG_NODES } from "@/lib/arkh/stats/defs/damage";
import { formatDamage, formatDamageLine } from "./format";
import { damageGainsModel } from "./gains";
import { TOP_DAMAGE_GENERATED_AT, TOP_DAMAGE_PLAYERS_SCANNED } from "./topDamage.meta";

/** Min = Max × Mastery; NaN (shown as a dash) when the tree has no Mastery node. */
const minOf = (tree: ArkhNode | null | undefined, max: number): number =>
  max * Number(tree?.children?.find((c) => c.name === DMG_NODES.mastery)?.val);

const full = (x: number) => (Number.isFinite(x) ? Math.ceil(x).toLocaleString("en-US") : "—");

export const DAMAGE_PAGE: StatPageConfig = {
  statName: "Damage",
  readingStat: "damage",
  gainLabel: "Damage",
  emoji: "⚔️",
  calculatorTitle: "Damage Calculator",
  subtitle:
    "Computes every character's damage from your save — the Damage line of the in-game Player Info panel (Min ~ Max). Select character & map. All processing local in your browser.",
  totalLabel: "Damage",
  mapTitle: "The map sets the Royal Guardian arena (map 43) and Clamworks' damage divider (map 306)",
  errPrefix: "Damage compute failed",
  storage: {
    save: "damage-tracker.last-upload.v1",
    name: "damage-tracker.playerName",
    snapshots: "damage-tracker.v1",
    collapse: "damage.snapshot-section.collapsed.v1",
    exportPrefix: "damage-snapshots",
    exportLabel: "damage-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeDamage").then((m) => m.computeArkhDamage(save, charIdx, mapIdx)),
  formatTotal: formatDamage,
  unit: "",
  headline: (tree, total) => formatDamageLine(minOf(tree, total), total),
  totalTitle: (x, tree) => `Min ${full(minOf(tree, x))} ~ Max ${full(x)}`,
  gains: damageGainsModel,
  loadTop: () => import("./topDamage").then((m) => ({ flatForClass: (classKey: string | null) => m.topDamageFlatForClass(classKey) })),
  topMeta: { generatedAt: TOP_DAMAGE_GENERATED_AT, playersScanned: TOP_DAMAGE_PLAYERS_SCANNED },
  methodologyNote:
    "Damage gain = how much your Max damage would rise if this source matched the Observed Max — the best value of each " +
    "source among the top players — recomputed through the game's formula: Base Damage × Damage % × Damage Multipliers, " +
    "each with its soft cap. The gain is measured on Max (Min is Max × Mastery). Observed Max is built per class family " +
    "(beginner, warrior, archer, mage) only for the sources that scale with a character stat (primary stat, Weapon Power, " +
    "HP, MP, move speed); every other source takes the best value across all players. Class talents folded into those " +
    "stats can't be told apart by class, so a family's reference may include a sibling class's talents there. Active buffs (Talents 108/124) and " +
    "masterclass forms (Wraith, Tempest, Tesseract) are not counted, and neither is the dungeon branch. On map 43 the Royal Guardian arena replaces the " +
    "whole Max, so nothing is ranked there.",
  compareTitle: "Compare every Damage source against the best value observed across the top players",
  gainsTabTitle: "Rank your Damage sources by how much Max damage matching the top players would give",
  footer:
    "Damage is computed locally from your save with the game's damage formula: base, percent and multipliers, with the three soft caps. " +
    "Not counted: active buffs, masterclass forms (Wraith, Tempest, Tesseract) and dungeons.",
};
