// The Coin Multi page's display config: the root, the weekly vote's node and the groups (ids = the coin system's cases, N.js order).
// The engine (lib/game's tracker adapter, lib/game/trackers/coinMulti.ts) and the page's Biggest Gains model
// (pageConfig.ts) read this, so it lives here, not in the engine (Ruling B, as lib/dropRateV2/layers).
//   N.js ArbitraryCode("MonsterCash"): 22 multiplicative factors and one additive group, in game order. A group's shape:
//   pct -> 1 + sum/100      raw -> 1 + sum      min4 -> 1 + min(4, sum)

import type { StatGroup } from "@/lib/statTracker/groups";

export type CoinGroupKind = "pct" | "raw" | "min4";
export type CoinGroup = StatGroup & { kind: CoinGroupKind };

export const COIN_ROOT = "Coin Multi";

/** Class talents in the coin formula (per-char GetTalentNumber / TalentCalc): the Observed Max collector gates them per class by their
 *  "(Talent n)" node names. Talent 433 is account-wide (getbonus2) so it isn't listed. */
export const COIN_CLASS_TALENTS = [22, 657, 643, 644] as const;

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const COIN_VOTE_NAME = "Cash from Monsters (Weekly Vote 34)";

export const COIN_GROUPS: readonly CoinGroup[] = [
  { key: "g01", name: "🫧 Cash Bubbles", kind: "pct", sources: ["bubbleSTR", "bubbleAGI", "bubbleWIS"] },
  { key: "g02", name: "🐾 Cool Bird (Companion 24)", kind: "min4", sources: ["comp24"] },
  { key: "g03", name: "🐾 Balloonfish (Companion 38)", kind: "raw", note: "Coin drop multi", sources: ["comp38"] },
  { key: "g04", name: "🐾 Equinox Broadbass (Companion 45)", kind: "min4", sources: ["comp45"] },
  { key: "g05", name: "🐾 Potluck (Companion 159)", kind: "min4", sources: ["comp159"] },
  { key: "g06", name: "🛍️ Coin Stacking (Event Shop 9)", kind: "raw", sources: ["eventShop9"] },
  { key: "g07", name: "🛍️ Government Subsidy (Event Shop 20)", kind: "raw", sources: ["eventShop20"] },
  { key: "g08", name: "🎽 Bonus Money Gear", kind: "pct", sources: ["etc77"] },
  { key: "g09", name: "🍣 Tobo Twins (Sushi Tier 19)", kind: "pct", sources: ["sushi18"] },
  { key: "g10", name: "🍣 Aji Sashimi (Sushi Tier 38)", kind: "pct", sources: ["sushi37"] },
  { key: "g11", name: "🔬 Glimbo Linguistics · BOGO Offer", kind: "pct", note: "Research Grids 149 and 169", sources: ["grid149", "grid169"] },
  { key: "g12", name: "🎽 Extra Money Gear", kind: "pct", sources: ["etc100"] },
  { key: "g13", name: "🧰 Gold Set", kind: "pct", sources: ["goldSet"] },
  { key: "g14", name: "🎰 Gambit", kind: "pct", sources: ["gambit7"] },
  { key: "g15", name: "🎁 Cash Bundle", kind: "pct", sources: ["bunY"] },
  { key: "g16", name: "🌪️ Dustwalker (Talent 433)", kind: "pct", sources: ["dustWalker"] },
  { key: "g17", name: "🍽️ Meals · Maneki Kat · Fishing Buddy · Weekly Vote", kind: "pct", sources: ["mealCash", "artifact1", "roo6", "vote34"] },
  { key: "g18", name: "🏟️ Pet Arena · Friend Bonus · Pecunia Statue", kind: "raw", sources: ["arena5", "friend5", "arena14", "statue19"] },
  { key: "g19", name: "💻 Fungi Finger Pocketer · Vault Kills", kind: "pct", sources: ["mainframe9", "vault34", "vault37"] },
  { key: "g20", name: "🌟 Gumball Necklace (Pristine Charm 16)", kind: "pct", sources: ["pristine16"] },
  { key: "g21", name: "🙏 Jawbreaker Prayer", kind: "pct", sources: ["prayer8"] },
  { key: "g22", name: "⛪ Divinity · Crop Depot", kind: "pct", sources: ["divMinor3", "cropSC4"] },
  {
    key: "g23",
    name: "➕ Additive Pool",
    kind: "pct",
    sources: [
      "talent657", "vialCash", "etc3", "card11", "cardW5b1", "talent22",
      "flurbo4", "arcade10", "arcade11", "box13c", "guild8", "talent643",
      "talent644", "goldFood", "vault17", "ach235", "ach350", "ach376",
      "vault2", "vault14", "vault31", "ola420", "vault70",
    ],
  },
];
