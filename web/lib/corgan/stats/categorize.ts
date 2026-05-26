// ===== POOL CATEGORIZATION =====
// Group DR source rows by game system (Talents, Cards, Stamps, Alchemy,
// Farming, Gear, …) so additive pools render as
//
//   Main Additive Pool
//     ▾ Talents              (sum)
//        • Robbing Hood (Talent 279)
//        • Curse of Mr Looty Booty (Talent 24)
//        • …
//     ▾ Stamps               (sum)
//        • Golden Sixes Stamp (Stamp A38)
//     ▾ Cards                (sum)
//        • Drop Rate Cards (Card Type 10)
//        • …
//
// One bucket per game system gives the user finer granularity than the
// previous Character / Worlds / Boosts & Sets tri-split. Display order is
// the canonical SYSTEM_ORDER below — character progression first, then
// world systems, then gear / meta / multipliers.
//
// Post-Processing is OUT OF SCOPE: its items multiply in a fixed order and
// inserting wrappers would change the resulting product. Only Main Additive
// and LUK2 Additive pools are categorized.

import type { CorganNode } from "../node";

export type SystemKey =
  // Character progression
  | "Talents"
  | "Cards"
  | "Star Signs"
  | "Achievements"
  | "Companions"
  | "Friends"
  | "LUK / Stats"
  // World systems
  | "Stamps"
  | "Alchemy"
  | "Post Office"
  | "Arcade"
  | "Voting"
  | "Sigils"
  | "Prayers"
  | "Shrines"
  | "Guild"
  | "Shiny Pets"
  | "Tomes"
  | "Lab / Grids"
  | "Chips"
  | "Dreams"
  | "Cloud Bonus"
  | "Owl"
  | "Grimoire"
  | "Vault"
  | "Farming"
  | "Holes"
  | "Emperor"
  | "Legends"
  | "Spelunk Shop"
  | "Sushi RoG"
  | "Minehead"
  | "Button"
  // Gear / Boosts / Meta
  | "Gear"
  | "Golden Food"
  | "Set Bonuses"
  | "Bundles"
  | "Pristine Charms"
  | "Sneaking / OLA"
  | "Event Shop"
  | "Win Bonus"
  | "Exotic Crops"
  | "Other";

// Order = how the systems render top-to-bottom in each pool. Tweaked so
// progression-y stuff lives first, world systems middle, gear / meta last.
export const SYSTEM_ORDER: SystemKey[] = [
  "LUK / Stats",
  "Talents",
  "Cards",
  "Star Signs",
  "Achievements",
  "Companions",
  "Friends",
  "Stamps",
  "Alchemy",
  "Sigils",
  "Prayers",
  "Shrines",
  "Guild",
  "Arcade",
  "Voting",
  "Post Office",
  "Shiny Pets",
  "Tomes",
  "Lab / Grids",
  "Chips",
  "Dreams",
  "Cloud Bonus",
  "Owl",
  "Grimoire",
  "Vault",
  "Farming",
  "Exotic Crops",
  "Holes",
  "Emperor",
  "Legends",
  "Spelunk Shop",
  "Sushi RoG",
  "Minehead",
  "Button",
  "Gear",
  "Golden Food",
  "Set Bonuses",
  "Bundles",
  "Pristine Charms",
  "Sneaking / OLA",
  "Event Shop",
  "Win Bonus",
  "Other",
];

// Match against the full node name (after entity-names resolution the
// system tag sits at the end as "(Talent 279)" / "(Pristine Charm)" / etc.).
// We classify by the inner system token first, falling back to a prefix
// scan for the remaining wrappers (Farming rank9, Cavern upg82, etc.).
type Rule = { match: RegExp; system: SystemKey };
const RULES: Rule[] = [
  // ----- Character progression (entity-name-tagged) -----
  { match: /\(Talent\s/, system: "Talents" },
  {
    match: /\(Card[A-Za-z]*\s|\(Card Type\s|\(Card Set\s/,
    system: "Cards",
  },
  { match: /\(Star ?Sign\s/i, system: "Star Signs" },
  { match: /^Star Signs?\b/i, system: "Star Signs" },
  { match: /\(Achievement\s/, system: "Achievements" },
  { match: /\(Companion\s|\(CompMulti\s/i, system: "Companions" },
  { match: /\(Friend\s|^Friend\b/i, system: "Friends" },
  { match: /^(LUK|Total LUK|Sub-1000|Over-1000)\b/i, system: "LUK / Stats" },

  // ----- World systems (entity-name-tagged) -----
  { match: /\(Stamp\s/, system: "Stamps" },
  { match: /\(Bubble\s|\(Vial\s|^Droppin Loads|^Shimmer/i, system: "Alchemy" },
  { match: /\(Sigil\s|Sigil$/i, system: "Sigils" },
  { match: /\(Post Office\s/i, system: "Post Office" },
  { match: /\(Arcade\s/, system: "Arcade" },
  { match: /\(Voting\s|^Voting\b/i, system: "Voting" },
  { match: /\(Prayer\s/, system: "Prayers" },
  { match: /\(Shrine\s/, system: "Shrines" },
  { match: /\(Guild\s/, system: "Guild" },
  {
    match: /\(Shiny\s|\(Breeding\s|^Breeding\b|Shiny Pet/i,
    system: "Shiny Pets",
  },
  { match: /\(Tome\s/, system: "Tomes" },
  { match: /\(Grid\s|\(Lab\s/, system: "Lab / Grids" },
  { match: /\(Chip\s/, system: "Chips" },
  { match: /\(Dream\s|\(Dream Challenge\s/, system: "Dreams" },
  { match: /\(Cloud Bonus\s/i, system: "Cloud Bonus" },
  { match: /\(Owl\s|^Summoning Owl/i, system: "Owl" },
  { match: /\(Grimoire\s/, system: "Grimoire" },
  { match: /\(Vault\s/, system: "Vault" },
  { match: /\(Farming\s|^Farming\b/i, system: "Farming" },
  { match: /\(Exotic\s/i, system: "Exotic Crops" },
  {
    match:
      /\(Cavern\s|\(Measurement\s|\(Hole\s|\(Monument\s|^Monument\b|^Cavern\b|^Measurement\b/i,
    system: "Holes",
  },
  { match: /\(Emperor\s/, system: "Emperor" },
  { match: /\(Legend\s/, system: "Legends" },
  { match: /\(Spelunking\s|^Spelunking\b/i, system: "Spelunk Shop" },
  { match: /\(RoG Bonus\s|\(Sushi\s/, system: "Sushi RoG" },
  { match: /\(Minehead\s/, system: "Minehead" },
  { match: /\(Button\s/, system: "Button" },

  // ----- Gear / Boosts / Meta -----
  // EtcBonuses(N) wrappers are the equipment+obol+nametag+trophy gear
  // bucket. Classify the entire tagged label so the row reads as "Gear".
  {
    match:
      /^Drop Rate \(Gear\)|^Bonus Drop Rate \(Gear\)|^Drop Rate Multi \(Gear\)|^Drop Chance \(Gear\)/i,
    system: "Gear",
  },
  { match: /\(EtcBonuses?\s|\(Etc\s|^EtcBonuses/, system: "Gear" },
  { match: /\(Golden Food\s|\(GFood\s|^Golden Food/i, system: "Golden Food" },
  {
    match: /\(Smithing\s|\(Set Bonus\s|^Smithing\b/i,
    system: "Set Bonuses",
  },
  { match: /\(Bundle\s/, system: "Bundles" },
  { match: /\(Pristine\s|\(Pristine Charm\)/, system: "Pristine Charms" },
  { match: /\(Ola\s|^Sneaking\b/i, system: "Sneaking / OLA" },
  { match: /\(Event ?Shop\s/i, system: "Event Shop" },
  // Summoning win bonus — a meta progression bucket, distinct from Owl.
  { match: /\(Summoning\s|^Summoning\b/i, system: "Win Bonus" },
];

export function classifySystem(name: string): SystemKey {
  for (const r of RULES) if (r.match.test(name)) return r.system;
  return "Other";
}

/** Wrap pool items into per-system sub-nodes. Each system node sums its
 *  members (for additive '+' fmt) and renders them as children. Used for
 *  the Main Additive Pool and LUK2 Additive Pool — NOT Post-Processing
 *  (which is order-sensitive). */
export function categorizePoolItems(items: CorganNode[]): CorganNode[] {
  const buckets = new Map<SystemKey, CorganNode[]>();
  for (const it of items) {
    const sys = classifySystem(it.name);
    if (!buckets.has(sys)) buckets.set(sys, []);
    buckets.get(sys)!.push(it);
  }
  const ordered: CorganNode[] = [];
  for (const sys of SYSTEM_ORDER) {
    const list = buckets.get(sys);
    if (!list || list.length === 0) continue;
    const sum = list.reduce((a, n) => a + (Number(n.val) || 0), 0);
    ordered.push({
      name: sys,
      val: sum,
      fmt: "+",
      children: list,
    });
  }
  return ordered;
}
