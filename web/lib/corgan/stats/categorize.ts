// ===== POOL CATEGORIZATION =====
// Group DR source rows by game system (Talents, Cards, Stamps, Alchemy,
// Farming, Gear, …) so additive pools render as
//
//   Main Additive Pool
//     ▾ Talents              (sum)
//        • Robbing Hood (Talent 279)
//        • Curse of Mr Looty Booty (Talent 24)
//     ▾ Stamps               (sum)
//        • Golden Sixes Stamp (Stamp A38)
//     …
//
// Two grouping strategies:
//   • "merge"  — collect ALL items of the same system into one bucket,
//                regardless of where they appeared in the source array.
//                Used by the additive pools where order doesn't matter.
//   • "runs"   — group only CONSECUTIVE same-system items. If the formula
//                order interleaves systems, the same bucket can appear
//                more than once. Used by Post-Processing because the
//                multiplicative chain in defs/drop-rate.ts is order-
//                sensitive — preserving the visual reading order matches
//                the formula's actual application order.

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
  | "Tome"
  | "Researching"
  | "Chips"
  | "Dreams"
  | "Cloud Bonus"
  | "Owl"
  | "Grimoire"
  | "Vault"
  | "Farming"
  | "Holes"
  | "Emperor"
  | "Legend Talents"
  | "Spelunk Shop"
  | "Sushi"
  | "Minehead"
  | "Button"
  | "Arcane Map"
  | "Glimbo"
  | "Workshop"
  // Gear / Boosts / Meta
  | "Gear"
  | "Golden Food"
  | "Set Bonuses"
  | "Bundles"
  | "Pristine Charms"
  | "Sneaking / OLA"
  | "Event Shop"
  | "Summoning"
  | "Other";

// Display order used by the "merge" mode (additive pools).
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
  "Tome",
  "Researching",
  "Chips",
  "Dreams",
  "Cloud Bonus",
  "Owl",
  "Grimoire",
  "Vault",
  "Farming",
  "Holes",
  "Emperor",
  "Legend Talents",
  "Spelunk Shop",
  "Sushi",
  "Minehead",
  "Button",
  "Arcane Map",
  "Glimbo",
  "Workshop",
  "Gear",
  "Golden Food",
  "Set Bonuses",
  "Bundles",
  "Pristine Charms",
  "Sneaking / OLA",
  "Event Shop",
  "Summoning",
  "Other",
];

// Match against the full node name (after entity-names resolution the
// system tag sits at the end as "(Talent 279)" / "(Pristine Charm)" / etc.).
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
  { match: /\(Tome\s/, system: "Tome" },
  { match: /\(Grid\s|\(Lab\s/, system: "Researching" },
  { match: /\(Chip\s/, system: "Chips" },
  { match: /\(Dream\s|\(Dream Challenge\s/, system: "Dreams" },
  { match: /\(Cloud Bonus\s/i, system: "Cloud Bonus" },
  { match: /\(Owl\s|^Summoning Owl/i, system: "Owl" },
  { match: /\(Grimoire\s/, system: "Grimoire" },
  { match: /\(Vault\s/, system: "Vault" },
  // Exotic crops are part of the Farming system — collapse the bucket so
  // Pommelion Seed (Exotic 59), Crop Drop Rate Rank etc. all land here.
  { match: /\(Farming\s|^Farming\b|\(Exotic\s/i, system: "Farming" },
  {
    match:
      /\(Cavern\s|\(Measurement\s|\(Hole\s|\(Monument\s|^Monument\b|^Cavern\b|^Measurement\b/i,
    system: "Holes",
  },
  { match: /\(Emperor\s/, system: "Emperor" },
  { match: /\(Legend\s/, system: "Legend Talents" },
  { match: /\(Spelunking\s|^Spelunking\b/i, system: "Spelunk Shop" },
  { match: /\(RoG Bonus\s|\(Sushi\s/, system: "Sushi" },
  { match: /\(Minehead\s|^Minehead\b/i, system: "Minehead" },
  { match: /\(Button\s/, system: "Button" },
  { match: /^Arcane Map|^Arcane\b/i, system: "Arcane Map" },
  { match: /^Glimbo\b/i, system: "Glimbo" },
  { match: /^Workshop\b/i, system: "Workshop" },

  // ----- Gear / Boosts / Meta -----
  // EtcBonuses(N) gear wrappers — equipment + obol + nametag + trophy.
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
  // Win Bonus is the Summoning sub-system — keep them together as Summoning.
  { match: /\(Summoning\s|^Summoning\b|Summoning Win/i, system: "Summoning" },
];

export function classifySystem(name: string): SystemKey {
  for (const r of RULES) if (r.match.test(name)) return r.system;
  return "Other";
}

export type AggregateMode = "additive" | "multiplicative";

/** Roll a single bucket's children into a summary value matching its
 *  aggregation mode. Additive: simple Σ. Multiplicative: PRODUCT of each
 *  item's effective multiplier — fmt='x' items pass through, fmt='+'
 *  items become 1 + val/100 (mirroring the post-mult chain arithmetic
 *  in defs/drop-rate.ts combine()). */
function summariseBucket(
  items: CorganNode[],
  mode: AggregateMode
): { val: number; fmt: "+" | "x" } {
  if (mode === "additive") {
    const sum = items.reduce((a, n) => a + (Number(n.val) || 0), 0);
    return { val: sum, fmt: "+" };
  }
  let product = 1;
  for (const n of items) {
    const v = Number(n.val) || 0;
    if (n.fmt === "x") product *= v || 1;
    else product *= 1 + v / 100;
  }
  return { val: product, fmt: "x" };
}

/** "merge" mode — combine ALL items of the same system into one bucket,
 *  reordering them by SYSTEM_ORDER. Used by Main Additive Pool and LUK2
 *  Additive Pool where the source order is descriptor-only and reordering
 *  doesn't change the math (additive sums are commutative). */
function categorizeMerged(
  items: CorganNode[],
  mode: AggregateMode
): CorganNode[] {
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
    const { val, fmt } = summariseBucket(list, mode);
    ordered.push({ name: sys, val, fmt, children: list });
  }
  return ordered;
}

/** "runs" mode — group only CONSECUTIVE same-system items, preserving
 *  the original sequence. The same system can appear more than once if
 *  the source order interleaves it with others. Used by Post-Processing
 *  because the multiplicative chain in combine() applies items in this
 *  exact sequence (e.g. bunV → talent328 → ola232 → bunP → …) — the
 *  display order has to match the formula's reading order even if that
 *  means showing "Bundles" twice. */
function categorizeRuns(
  items: CorganNode[],
  mode: AggregateMode
): CorganNode[] {
  const out: CorganNode[] = [];
  let currentSys: SystemKey | null = null;
  let run: CorganNode[] = [];
  const flushRun = () => {
    if (!currentSys || run.length === 0) return;
    const { val, fmt } = summariseBucket(run, mode);
    out.push({ name: currentSys, val, fmt, children: run });
    run = [];
  };
  for (const it of items) {
    const sys = classifySystem(it.name);
    if (sys !== currentSys) {
      flushRun();
      currentSys = sys;
    }
    run.push(it);
  }
  flushRun();
  return out;
}

/** Wrap pool items into per-system sub-nodes. The strategy decides
 *  whether items with the same system are merged or only grouped when
 *  consecutive (formula order preserved). */
export function categorizePoolItems(
  items: CorganNode[],
  mode: AggregateMode = "additive",
  strategy: "merge" | "runs" = "merge"
): CorganNode[] {
  return strategy === "runs"
    ? categorizeRuns(items, mode)
    : categorizeMerged(items, mode);
}
