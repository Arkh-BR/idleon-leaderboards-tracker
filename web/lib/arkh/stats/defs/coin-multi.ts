// ===== COIN MULTI DESCRIPTOR =====
// N.js ArbitraryCode("MonsterCash") (live sha 6de681a96813): 22 multiplicative
// factors and one additive group, in game order. Every term is a source of
// the `coin` system (systems/coin/coin.ts); a group's shape lives here:
//   pct → 1 + Σ/100      raw → 1 + Σ      min4 → 1 + min(4, Σ)

import type { Descriptor } from "../tree-builder";
import { groupedDescriptor, groupFactorOf, type StatGroup } from "./grouped";

export type CoinGroupKind = "pct" | "raw" | "min4";
export type CoinGroup = StatGroup & { kind: CoinGroupKind };

export const COIN_ROOT = "Coin Multi";

/** The weekly vote's node. The vote is server-wide and changes every week, so
 *  Biggest Gains leaves it out: it isn't something a player raises. */
export const COIN_VOTE_NAME = "Vote 34 (Cash)";

export const COIN_GROUPS: readonly CoinGroup[] = [
  { key: "g01", name: "🫧 Cash Bubbles", kind: "pct", sources: ["bubbleSTR", "bubbleAGI", "bubbleWIS"] },
  { key: "g02", name: "🐾 Companion 24", kind: "min4", sources: ["comp24"] },
  { key: "g03", name: "🐾 Coin Drop Multi", kind: "raw", sources: ["comp38"] },
  { key: "g04", name: "🐾 Companion 45", kind: "min4", sources: ["comp45"] },
  { key: "g05", name: "🐾 Companion 159", kind: "min4", sources: ["comp159"] },
  { key: "g06", name: "🛍️ Event Shop 9", kind: "raw", sources: ["eventShop9"] },
  { key: "g07", name: "🛍️ Event Shop 20", kind: "raw", sources: ["eventShop20"] },
  { key: "g08", name: "🎽 Bonus Money Gear", kind: "pct", sources: ["etc77"] },
  { key: "g09", name: "🍣 Sushi 18", kind: "pct", sources: ["sushi18"] },
  { key: "g10", name: "🍣 Sushi 37", kind: "pct", sources: ["sushi37"] },
  { key: "g11", name: "🔬 Research Grid", kind: "pct", sources: ["grid149", "grid169"] },
  { key: "g12", name: "🎽 Extra Money Gear", kind: "pct", sources: ["etc100"] },
  { key: "g13", name: "🧰 Gold Set", kind: "pct", sources: ["goldSet"] },
  { key: "g14", name: "🎰 Gambit", kind: "pct", sources: ["gambit7"] },
  { key: "g15", name: "🎁 Cash Bundle", kind: "pct", sources: ["bunY"] },
  { key: "g16", name: "🌪️ Dust Walker", kind: "pct", sources: ["dustWalker"] },
  { key: "g17", name: "🍽️ Meal · Artifact · Roo · Vote", kind: "pct", sources: ["mealCash", "artifact1", "roo6", "vote34"] },
  { key: "g18", name: "🏟️ Arena · Friend · Statue", kind: "raw", sources: ["arena5", "friend5", "arena14", "statue19"] },
  { key: "g19", name: "💻 Lab · Vault Kills", kind: "pct", sources: ["mainframe9", "vault34", "vault37"] },
  { key: "g20", name: "🌟 Pristine Charm 16", kind: "pct", sources: ["pristine16"] },
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

export function groupFactor(kind: CoinGroupKind, sum: number): number {
  return groupFactorOf({ kind }, [sum]);
}

const coinMultiDesc: Descriptor = groupedDescriptor({
  id: "coin-multi",
  name: COIN_ROOT,
  scope: "character+map",
  category: "economy",
  system: "coin",
  groups: COIN_GROUPS,
});

export default coinMultiDesc;
