// The EXP Multi page's display config: the root, the weekly vote's node, the circumstantial sources' names and the groups (ids = the exp
// system's cases, N.js order). Both engines (lib/arkh's descriptor and lib/game's tracker adapter, lib/game/trackers/expMulti.ts) and the
// page's Biggest Gains model (pageConfig.ts) read this, so it lives here, not in either engine (Ruling B, as lib/afkGains/layers).
//   EXP = Workbench x (1 + LUK3/100) x LUK5 x (1 + Etc78/100)
//         x (1 + LUKcurve*(1 + T35/100)/1.8 + S/100)
// LUK5 is split into G3-G8. G10 carries the LUK curve as two % sources (luk + talent35) so class gating can zero Lucky Charms alone.

import type { StatGroup } from "@/lib/statTracker/groups";

export const EXP_ROOT = "EXP Multi";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const EXP_VOTE_NAME = "Class EXP from Monsters (Weekly Vote 15)";

export const EXP_GROUPS: readonly StatGroup[] = [
  { key: "g01", name: "🛠️ Workbench", kind: "mult", sources: ["workbench"] },
  { key: "g02", name: "🎁 Bundle + Superbit", kind: "pct", sources: ["bunQ", "superbit19"] },
  { key: "g03", name: "🏅 Shiny Medallions", kind: "mult", sources: ["medallion429"] },
  {
    key: "g04",
    name: "🐾 Companions · Jelly · Lab",
    kind: "mult",
    max1: true,
    sources: [
      "comp37", "comp33", "comp160", "comp32", "arenaCruc15", "menagerie23", "comp168", "comp34", "comp145", "jelly30",
      "jelly62", "comp128", "gridExp", "sticker0", "superbit63", "zenith9", "comp50",
    ],
  },
  { key: "g05", name: "🎽 Gear · Card · Arcade · Vial", kind: "mult", sources: ["etc84", "card100", "arcade60", "vialClassExp"] },
  { key: "g06", name: "⚔️ Slayer Abominator", kind: "mult", sources: ["talent434"] },
  {
    key: "g07",
    name: "🗺️ Arcane · Spelunk · Reef · Sets",
    kind: "mult",
    sources: [
      "arcane1", "bigFish4", "dancingCoral3", "coralKid", "cardSet12", "bubba6", "sushi15",
      "cloud70", "fountain16", "royalStatue3",
    ],
  },
  { key: "g08", name: "💎 Classy Discoveries", kind: "mult", sources: ["classy"] },
  { key: "g09", name: "🎽 Class EXP Equip", kind: "pct", sources: ["etc78"] },
  {
    key: "g10",
    name: "➕ Additive Pool",
    kind: "pct",
    sources: [
      "luk", "talent35", "etc4", "boxMonsterExp", "food", "starSignMainXP", "vialMonsterExp",
      "bubbleExp", "card44",
      // ExpGainLUK2
      "merit3", "vault12", "cardSet0", "mealClexp", "weeklyBoss", "newbie", "divMinor4", "cardSet5",
      "statue10", "talent632", "shrine5", "saltLick3", "prayer0", "prayer2", "prayer9", "flurbo2",
      "ach57", "ach357", "ach61", "ach124", "ach188", "arcade12", "sigil8", "ach286", "shiny1",
      "msa4", "talent55",
      // ExpGainLUK6 (with ExpGainLUK4 inside it, after the monument)
      "cardSpring", "comp3", "comp50add", "shimmer179", "goldFood", "owl0", "vote15", "monument1_6",
      "compass51", "hole47", "win23", "grimoire24", "vault3", "vault35", "hole83",
      "ironSet", "exotic50", "ola421", "stampClassxp", "friend1", "comp47", "comp111", "button8",
      "comp128add",
    ],
  },
];

/** Node names of the six circumstantial EXP sources: a character can never actually get these unless it's the account's lowest-level char
 *  (superbit19, merit3, vault12) or it's still under the relevant level cap (newbie, cardSet0, mealClexp). Biggest Gains excludes them from
 *  the ranking (they'd rank a source the viewed character can't reach) - see groupedGainsModel's `skip` option in
 *  lib/statTracker/biggestGains.ts. Named constants so the skip list can never drift from the actual node names. */
export const NOOBIE_GAINS_NAME = "Noobie Gains (Super Bit 19)";
export const MERIT_LOWEST_LEVEL_NAME = "Merit: EXP for Lowest-Level Character";
export const VAULT_12_NAME = "Baby on Board (Vault 12)";
export const NEWBIE_BRACKET_NAME = "Newbie Bracket";
export const CARD_SET_0_NAME = "EXP if below Lv 50 Set Bonus (Card Set 0)";
export const MEALS_CLEXP_NAME = "Class EXP Meals (below Lv 120)";

export const EXP_CIRCUMSTANTIAL_SOURCE_NAMES = [
  NOOBIE_GAINS_NAME,
  MERIT_LOWEST_LEVEL_NAME,
  VAULT_12_NAME,
  NEWBIE_BRACKET_NAME,
  CARD_SET_0_NAME,
  MEALS_CLEXP_NAME,
] as const;
