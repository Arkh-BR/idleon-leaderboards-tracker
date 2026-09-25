// ===== EXP MULTI DESCRIPTOR =====
// N.js x._customBlock_ExpMulti(0) (@4238487–@4247524): the character's Class
// EXP multiplier, the "Class EXP:" line of the stats panel. Every term is a
// source of the `exp` system (systems/exp/exp.ts); the group shapes live here.
//   EXP = Workbench × (1 + LUK3/100) × LUK5 × (1 + Etc78/100)
//         × (1 + LUKcurve·(1 + T35/100)/1.8 + Σ/100)
// LUK5 is split into G3–G8. G10 carries the LUK curve as two % sources
// (luk + talent35) so class gating can zero Lucky Charms alone.

import { groupedDescriptor, type StatGroup } from "./grouped";

export const EXP_ROOT = "EXP Multi";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const EXP_VOTE_NAME = "Vote 15 (Class EXP)";

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
      "comp37", "comp33", "comp160", "comp32", "comp168", "comp34", "comp145", "jelly30",
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

const expMultiDesc = groupedDescriptor({
  id: "exp-multi",
  name: EXP_ROOT,
  scope: "character+map",
  category: "progression",
  system: "exp",
  groups: EXP_GROUPS,
});

export default expMultiDesc;
