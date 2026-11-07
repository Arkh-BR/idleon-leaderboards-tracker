// The Artifact Find page's display config: the root node, the group list and the vote's node
// name. N.js Sailing("BoatArtiMulti", 0) is one additive group (A1–A11) and 23 multiplicative
// factors (M1–M23), in game order; each source id is one term of it. Both engines (lib/arkh's
// descriptor and lib/game's tracker adapter) and the page's Biggest Gains model read this list, so
// it lives here, not in either engine.
//   pct → 1 + Σ/100      raw → 1 + Σ      mult → Π (max1: Math.max(1, Π))

import type { StatGroup } from "@/lib/statTracker/groups";

export const ARTI_ROOT = "Artifact Find";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const ARTI_VOTE_NAME = "Artifact Find (Weekly Vote 20)";

export const ARTI_GROUPS: readonly StatGroup[] = [
  {
    key: "a",
    name: "➕ Additive Pool",
    kind: "pct",
    sources: [
      "artifact3", "captain", "shiny21", "fractal3", "bribe34", "captains6",
      "arcade32", "arcade66", "bUpg55", "sticker2add", "grid109", "vault63",
    ],
  },
  { key: "m01", name: "⭐ Artifosho Star Sign", kind: "pct", sources: ["starSign61"] },
  { key: "m02", name: "🏷️ Chocotastic Muffin Sticker (Sticker 2)", kind: "pct", sources: ["sticker2mult"] },
  { key: "m03", name: "🌊 Nightmariner", kind: "mult", sources: ["nightmariner"] },
  { key: "m04", name: "🐾 Glimbo (Companion 154)", kind: "mult", max1: true, sources: ["comp154"] },
  { key: "m05", name: "🦈 Killroy Skull Shop (Artifact Find)", kind: "mult", max1: true, note: "Skull Shop upgrade 11 (KillroyBonuses 0)", sources: ["killroy"] },
  { key: "m06", name: "🔘 Artifact Odds (Minehead Button 3)", kind: "pct", sources: ["button3"] },
  { key: "m07", name: "🔬 The Maw (Research Grid 106)", kind: "pct", sources: ["grid106"] },
  { key: "m08", name: "🧪 Turtle Tisane (Vial 74)", kind: "pct", sources: ["vialTurtle"] },
  { key: "m09", name: "🐌 Noble Sluggo (Event Shop 48)", kind: "mult", max1: true, sources: ["slugs"] },
  { key: "m10", name: "🍣 Cucumber Uramaki (Sushi Tier 8)", kind: "pct", sources: ["sushi7"] },
  { key: "m11", name: "🏆 Artifact Find (Winner Bonus 3)", kind: "pct", sources: ["win3"] },
  { key: "m12", name: "🪼 Sapphire Ring (Jelly Obstruction 20)", kind: "pct", sources: ["jelly19"] },
  { key: "m13", name: "☠️ Davey Jones", kind: "mult", sources: ["davey"] },
  { key: "m14", name: "💻 Artifact Attraction (Mainframe 14)", kind: "pct", sources: ["mainframe14"] },
  { key: "m15", name: "📜 Artifact Find (Lore Episode 3)", kind: "pct", sources: ["loreEpi3"] },
  { key: "m16", name: "🌟 Glowing Veil (Pristine Charm 2)", kind: "pct", sources: ["pristine2"] },
  { key: "m17", name: "🗳️ Weekly Vote", kind: "pct", sources: ["vote20"] },
  { key: "m18", name: "🐾 Litterfish (Companion 43)", kind: "raw", sources: ["comp43"] },
  { key: "m19", name: "🐾 Magni Pufferfin (Companion 56)", kind: "mult", max1: true, sources: ["comp56"] },
  { key: "m20", name: "🗿 Justice Monument", kind: "pct", sources: ["monument1_2"] },
  { key: "m21", name: "🌿 5 Leaf Clover (Exotic Market 45)", kind: "pct", sources: ["exotic45"] },
  { key: "m22", name: "🎨 Bright Cyan (Palette 5)", kind: "pct", sources: ["palette5"] },
  { key: "m23", name: "⛏️ Artifacto Discoveries (Super Bit 26)", kind: "mult", max1: true, sources: ["spelunkBit26"] },
];
