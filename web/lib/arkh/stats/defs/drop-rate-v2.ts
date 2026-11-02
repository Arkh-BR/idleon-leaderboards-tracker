// ===== DROP RATE V2 DESCRIPTOR =====
// N.js _customBlock_TotalStats("Drop_Rarity") (@4188223, live sha 4a6cb9a0c645),
// outside a dungeon, term by term in game order. Every term is a source of the
// `dr2` system (systems/dr2/dr2.ts); the shapes and the order live here:
//   base  = 1 + 1.4·DropRateLUK + Σ/100 (Σ holds DropRateLUK2 term by term;
//           the LUK source is 140·DropRateLUK so it lands outside the /100)
//   chip  : under 5, min(5, total + chipBonuses("dr")/100)
//   +2 bun_v · × Workbench · +0.3 if OLA[232] ≥ 1 · ×1.2 bun_p
//   × every post-processing factor (one group each)
//   Cove  : on map 216 in cavern 17 Holes2("Cglunko_DR") replaces the total.
// The V1 descriptor (defs/drop-rate.ts) is a separate port and stays as is.

import type { Descriptor } from "../tree-builder";
import { groupedDescriptor, type StatGroup } from "./grouped";

export const DR2_ROOT = "Drop Rate";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const DR2_VOTE_NAME = "Drop Rate (Weekly Vote 27)";

// @njs _customBlock_TotalStats
export const DR2_GROUPS: readonly StatGroup[] = [
  {
    key: "base",
    name: "➕ Additive Pool",
    kind: "pct",
    note: "1 + 1.4 × LUK curve + Σ/100: the LUK source is 140 × the curve, outside the /100",
    sources: [
      "luk",
      // Σ, in N.js order
      "talent279", "box11", "etc2", "etc102", "bubble", "card10", "talent24", "starSigns", "guild10",
      "cardSet5", "cardSet6", "shrine4", "prayer7", "sigil11", "shiny0", "arcade27", "comp3", "comp50",
      "stamp", "talent655", "dream10", "win9", "tome2",
      // DropRateLUK2
      "mini5a", "caveCards", "anni4", "luckEvent", "goldFood", "ach377", "ach381", "owl4", "rank9",
      "vote27", "hole46", "cropSC7", "grimoire44", "vault18", "meas15", "comp22", "comp158", "hole82",
      "monument", "emperor11", "efaunt", "exotic59", "friend3", "legend1", "spelunk50", "comp111", "talent239",
      // back in Σ
      "grid173", "comp132",
    ],
  },
  { key: "chip", name: "🔌 Grounded Processor (Lab Chip 3)", kind: "add", below: 5, sources: ["chip"] },
  { key: "bunV", name: "🎁 Death Bringer Bundle", kind: "add", sources: ["bunV"] },
  { key: "workbench", name: "🛠️ Workbench", kind: "mult", note: "WorkbenchStuff(\"AdditionExtraEXPnDR\")", sources: ["workbench"] },
  { key: "ola232", name: "🥷 Sneaking Mastery", kind: "add", sources: ["ola232"] },
  { key: "bunP", name: "🎁 Explorer Bundle", kind: "mult", sources: ["bunP"] },
  { key: "arcane", name: "🗺️ Arcane Map Bonus: Drop Rate", kind: "pct", sources: ["arcane"] },
  { key: "statue1", name: "👑 Royal Statue: Drop Rate", kind: "pct", sources: ["statue1"] },
  { key: "menagerie24", name: "🦁 Menagerie Boost: Drop Rate", kind: "pct", sources: ["menagerie24"] },
  { key: "card101", name: "🃏 Drop Rate Multi Cards (Card Type 101)", kind: "pct", sources: ["card101"] },
  { key: "family32", name: "👪 Royal Guardian Family Bonus", kind: "pct", sources: ["family32"] },
  { key: "comp168", name: "🐾 Crystal Glunko (Companion 168)", kind: "mult", sources: ["comp168x"] },
  { key: "comp132", name: "🐾 Mama Troll (Companion 132)", kind: "mult", sources: ["comp132x"] },
  { key: "rog", name: "🍣 Unagi Nigiri · Gold Bangle", kind: "pct", note: "Sushi RoG 48 + Jelly RoG 14", sources: ["sushi48", "jelly14"] },
  { key: "glimbo", name: "🔬 Glimbo Insider Trading Secrets (Research Grid 168)", kind: "mult", max1: true, sources: ["glimbo"] },
  { key: "tome7", name: "📖 Drop Rate Multi (Tome 7)", kind: "pct", sources: ["tome7"] },
  { key: "etc99", name: "🎽 Bonus Drop Rate (Equipment)", kind: "pct", sources: ["etc99"] },
  { key: "minehead0", name: "⛏️ Total Damage and Drop Rate (Minehead Floor 0)", kind: "pct", sources: ["minehead0"] },
  { key: "cloud69", name: "☁️ Megaflesh Collector (Equinox Challenge 69)", kind: "pct", sources: ["cloud69"] },
  { key: "pristine3", name: "🌟 Cotton Candy (Pristine Charm 3)", kind: "pct", sources: ["pristine3"] },
  { key: "etc91", name: "🎽 Drop Rate Multi (Equipment)", kind: "pct", sources: ["etc91"] },
  { key: "vial", name: "🧪 Ship in a Bottle (Vial 84)", kind: "pct", sources: ["vial"] },
  { key: "comp26x160", name: "🐾 Mallay · Glunko The Massive", kind: "mult", max1: true, note: "Companions 26 and 160", sources: ["comp26", "comp160"] },
  { key: "comp50", name: "🐾 Santa Snake (Companion 50)", kind: "mult", max1: true, sources: ["comp50x"] },
  { key: "cove", name: "🏝️ Crystal Glunko Cove", kind: "replace", sources: ["cove"] },
];

const dropRateV2Desc: Descriptor = groupedDescriptor({
  id: "drop-rate-v2",
  name: DR2_ROOT,
  scope: "character+map",
  category: "combat",
  system: "dr2",
  groups: DR2_GROUPS,
});

export default dropRateV2Desc;
