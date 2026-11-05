// The Damage page's display config: the root, the root's children, the rule rows, and the layers with their steps and source ids.
// N.js DamageDealed("Max") is Base Damage x Damage % x Damage Multipliers, each layer run step by step in game order (a group of
// sources, a soft cap, the Reliquarium exponent); the Royal Guardian arena (map 43) replaces Max; Mastery (Min = Max x Mastery) is a
// group of its own. Both engines (lib/arkh's descriptor and lib/game's tracker adapter) and the page's Biggest Gains model read this list,
// so it lives here, not in either engine (Ruling B). The math over it (caps, layers, Max) stays with each engine.

import type { StatGroup } from "@/lib/arkh/stats/defs/grouped";

export const DMG_ROOT = "Damage";

/** The root's children. Fixed names, so snapshot and Observed Max paths never move. */
export const DMG_NODES = {
  base: "Base Damage",
  pct: "Damage %",
  mult: "Damage Multipliers",
  mastery: "Mastery (Min)",
} as const;

/** Rows that are rules rather than sources: the three soft caps, the
 *  Reliquarium exponent and the map-43 replacement. */
export const DMG_RULES = {
  capBase: "Base Damage soft cap",
  capPct: "Damage % soft cap",
  capMult: "Damage Multipliers soft cap",
  relic: "Reliquarium",
  rat: "Royal Guardian arena (map 43)",
} as const;

/** Pool keys other code needs by name. `map`: the map-306 divider's group, a
 *  map rule rather than a source (Biggest Gains never ranks it). */
export const DMG_KEYS = { map: "l2map" } as const;

/** One step of a layer: a group acting on the running total, the layer's soft
 *  cap (no sources), or the Reliquarium exponent (`v ** e`; its source is 0
 *  when not owned, which is the neutral step). */
export type DmgStep =
  | StatGroup
  | { key: string; name: string; kind: "cap" }
  | { key: string; name: string; kind: "pow"; sources: readonly string[] };

export type DmgLayer = { key: "base" | "pct" | "mult"; node: string; start: number; steps: readonly DmgStep[] };

/** Source values are the ones the engines resolve: a `mult` source is
 *  an already-built factor (1 + x/100, or the N.js factor), a `pct`/`add` source
 *  is the summed term, `pow` is the exponent (0 = off), `replace` is > 0 only on
 *  map 43. */
export const DMG_LAYERS: readonly DmgLayer[] = [
  {
    key: "base",
    node: DMG_NODES.base,
    start: 0,
    steps: [
      {
        key: "l0",
        name: "Base Damage sources",
        kind: "add",
        sources: [
          "wpSquared", "statType", "goldFoodBase", "statWpFloor", "arcade0", "owl1", "vault0", "vault20", "stampBaseDmg",
          "etc16", "statue0", "boxBaseDmg", "bubbleHP", "bubbleSPD", "bubbleMP", "card4", "sigil4", "cardFallEvent2",
        ],
      },
      { key: "capBase", name: DMG_RULES.capBase, kind: "cap" },
      { key: "l0food", name: "Food (after soft cap)", kind: "add", sources: ["foodBaseDmg"] },
    ],
  },
  {
    key: "pct",
    node: DMG_NODES.pct,
    start: 1,
    steps: [
      {
        key: "l1base",
        name: "Damage % sources",
        kind: "pct",
        sources: [
          "statPow", "vault27", "vault15", "vault10", "bribe30", "bribe20", "stampPctDmg", "lankRank14", "statue22",
          "talent113", "talent86", "talent446", "owl2", "roo4", "bubbaRoG4", "vault80", "spelunkShop64",
        ],
      },
      { key: "l1smith", name: "Smithing level", kind: "pct", sources: ["talent284"] },
      { key: "l1win", name: "Summoning Win Bonus", kind: "pct", sources: ["win0"] },
      {
        key: "l1chain",
        name: "Talents & skills",
        kind: "pct",
        sources: [
          "talent463", "bubbleW12", "bubbleA12", "bubbleM12", "tc31", "tc110", "tc125", "tc485", "tc305", "tc470", "bUpg57",
          "talent290", "tc656", "talent649", "talent638", "talent658", "divMinor7",
        ],
      },
      { key: "l1gold", name: "Golden Food", kind: "mult", sources: ["goldFoodDmg"] },
      { key: "capPct", name: DMG_RULES.capPct, kind: "cap" },
    ],
  },
  {
    key: "mult",
    node: DMG_NODES.mult,
    start: 1,
    steps: [
      { key: "l2wb", name: "Workbench", kind: "mult", sources: ["workbench"] },
      {
        key: "l2a",
        name: "Multipliers",
        kind: "mult",
        sources: ["vial7dmg", "eclipse", "palette34", "dream6", "pristine0", "summUpg79", "cglunko19"],
      },
      {
        key: "l2buff",
        name: "Buffs, Friends & Star Signs",
        kind: "pct",
        sources: ["buff108", "friend0", "starSignPctDmg", "divinity507", "level50"],
      },
      {
        key: "l2grim",
        name: "Account bonuses I",
        kind: "pct",
        sources: [
          "grimoire35", "lustreSet", "shrine0", "monument06", "box12c", "box21c", "box23c", "fam20", "artifact25", "atom9",
          "shiny5", "msa0", "shimmer178", "cropSC0", "vault41",
        ],
      },
      {
        key: "l2rift",
        name: "Account bonuses II",
        kind: "pct",
        sources: [
          "riftEtc0", "pctDmg1", "pctDmg2", "pctDmg3", "artifact2", "artifact8", "bubbleW5", "bubbleA5", "bubbleM5",
          "constMastery1", "tome0", "compass48", "exotic41", "ola419",
        ],
      },
      {
        key: "l2t6",
        name: "Account bonuses III",
        kind: "pct",
        sources: [
          "talent6", "saltLick9", "etc45", "prayer15", "mainframe0", "mainframe11", "mainframe110", "artifact27", "artifact29",
          "bUpg84", "arcade46", "ola435",
        ],
      },
      { key: "l2comp", name: "Companions & Cards", kind: "pct", sources: ["comp10", "comp156", "card42", "cardSet5"] },
      {
        key: "l2arena",
        name: "Arena, Chips, Meals & Achievements",
        kind: "pct",
        sources: ["petArena2", "petArena15", "chipDmg", "mealTotDmg", "achievements", "bless7", "bless8"],
      },
      { key: "l2penalty", name: "Penalties", kind: "mult", sources: ["penalty"] },
      {
        key: "l2late",
        name: "Late multipliers",
        kind: "mult",
        sources: ["minehead0", "wepPowDmg", "jelly37", "royalStatue0", "coralKid11", "weeklyBoss", "cactolyte"],
      },
      { key: "capMult", name: DMG_RULES.capMult, kind: "cap" },
      {
        key: "l2post",
        name: "After soft cap",
        kind: "mult",
        sources: [
          "etc72", "etc75", "etc104", "voting1", "fountain16", "sushi49", "superBit64", "ola232", "card96", "sticker", "tome6",
          "killroy",
        ],
      },
      { key: "l2post2", name: "Companions, Crystal & Sigils", kind: "mult", sources: ["companions", "crystal6", "meritoc5", "greenSigils"] },
      { key: "l2bundle", name: "Bundle & Family", kind: "mult", sources: ["bundleA", "fam80"] },
      { key: "l2relic", name: DMG_RULES.relic, kind: "pow", sources: ["reliquarium"] },
      { key: DMG_KEYS.map, name: "Map", kind: "mult", sources: ["map306"] },
    ],
  },
];

/** Mastery's sources: talent 113 comes in negative (N.js: 0.35 − GTN(2,113)/100). */
export const DMG_MASTERY: StatGroup = {
  key: "mastery",
  name: DMG_NODES.mastery,
  kind: "pct",
  sources: ["talent113b", "bubbleMastery", "card21", "talent123", "etc21"],
};

/** Map 43: RatDMG replaces Max (and Mastery becomes 0.2). The source is 0 elsewhere. */
export const DMG_RAT: StatGroup = { key: "rat", name: DMG_RULES.rat, kind: "replace", sources: ["ratDmg"] };
