// ===== POOL CATEGORIZATION =====
// Group DR source rows by game-system category so additive pools render as
//   Main Additive Pool
//     ▾ Character        (sum)
//        • Robbing Hood (Talent 279)
//        • Curse of Mr Looty Booty (Talent 24)
//        • …
//     ▾ Worlds           (sum)
//        • Golden Sixes Stamp (Stamp A38)
//        • …
//
// Categorization mirrors the "By System" view's logic — same Category
// buckets — but lives in the resolver layer so the tree itself carries the
// grouping. Post-Processing is OUT OF SCOPE: its items multiply in a fixed
// order and inserting category wrappers changes the resulting product.

import type { CorganNode } from "../node";

export type Category =
  | "Character"
  | "Worlds"
  | "Boosts & Sets"
  | "Other";

// Match against the full node name (after entity-names resolution, the
// system tag is at the end as "(Talent 279)" / "(Pristine Charm)" / etc.).
// We classify by the inner system token, falling back to a prefix scan for
// the remaining wrappers (Farming rank9, Cavern upg82, etc.).
type Rule = { match: RegExp; category: Category };
const RULES: Rule[] = [
  // Character progression
  { match: /\(Talent\s/, category: "Character" },
  { match: /\(Star ?Sign\s/i, category: "Character" },
  { match: /\(Card[A-Za-z]*\s|\(Card Type\s|\(Card Set\s/, category: "Character" },
  { match: /\(Achievement\s/, category: "Character" },
  { match: /\(Companion\s|\(CompMulti\s/i, category: "Character" },
  { match: /\(Friend\s/, category: "Character" },
  { match: /^(LUK|Total LUK|Sub-1000|Over-1000)\b/i, category: "Character" },

  // World systems
  { match: /\(Stamp\s/, category: "Worlds" },
  { match: /\(Bubble\s|\(Vial\s|\(Sigil\s/, category: "Worlds" },
  { match: /\(Post Office\s/i, category: "Worlds" },
  { match: /\(Arcade\s/, category: "Worlds" },
  { match: /\(Voting\s/, category: "Worlds" },
  { match: /\(Prayer\s/, category: "Worlds" },
  { match: /\(Shrine\s/, category: "Worlds" },
  { match: /\(Guild\s/, category: "Worlds" },
  { match: /\(Shiny\s|\(Breeding\s/, category: "Worlds" },
  { match: /\(Tome\s/, category: "Worlds" },
  { match: /\(Grid\s|\(Lab\s/, category: "Worlds" },
  { match: /\(Chip\s/, category: "Worlds" },
  { match: /\(Dream\s|\(Dream Challenge\s/, category: "Worlds" },
  { match: /\(Cloud Bonus\s/i, category: "Worlds" },
  { match: /\(Owl\s/, category: "Worlds" },
  { match: /\(Grimoire\s/, category: "Worlds" },
  { match: /\(Vault\s/, category: "Worlds" },
  { match: /\(Farming\s/, category: "Worlds" },
  { match: /\(Cavern\s|\(Measurement\s|\(Hole\s|\(Monument\s/, category: "Worlds" },
  { match: /\(Emperor\s/, category: "Worlds" },
  { match: /\(Legend\s/, category: "Worlds" },
  { match: /\(Spelunking\s/, category: "Worlds" },
  { match: /\(RoG Bonus\s|\(Sushi\s/, category: "Worlds" },
  { match: /\(Minehead\s/, category: "Worlds" },
  { match: /\(Button\s/, category: "Worlds" },
  // Tag-less wrappers (no entity-name suffix)
  { match: /^(Farming|Cavern|Measurement|Spelunking|Summoning|Breeding)\b/i, category: "Worlds" },
  // Wrappers that route through the entity-name tag but use multi-word
  // system names ("Star Signs", "Monument Drop Rate")
  { match: /^Star Signs?\b/i, category: "Character" },
  { match: /^Monument\b/i, category: "Worlds" },
  // Voting / Friend bonuses, currently tag-less
  { match: /^Voting\b|^Friend\b/i, category: "Character" },
  // Exotic crops appear tag-less in some paths
  { match: /\(Exotic\s/i, category: "Worlds" },
  { match: /\(Owl\s|Owl Bonus/i, category: "Worlds" },

  // Boosts & meta
  { match: /\(Golden Food\s|\(GFood\s|^Golden Food/i, category: "Boosts & Sets" },
  { match: /\(EtcBonuses?\s|\(Etc\s|^EtcBonuses/, category: "Boosts & Sets" },
  // EtcBonuses(N) is the equipment+obol gear wrapper — its OWN bucket is
  // gear, not Worlds; classify the full tagged label here.
  { match: /^Drop Rate \(Gear\)|^Bonus Drop Rate \(Gear\)|^Drop Rate Multi \(Gear\)|^Drop Chance \(Gear\)/i, category: "Boosts & Sets" },
  { match: /\(Smithing\s|\(Set Bonus\s/, category: "Boosts & Sets" },
  { match: /\(Bundle\s/, category: "Boosts & Sets" },
  { match: /\(Pristine\s|\(Pristine Charm\)/, category: "Boosts & Sets" },
  { match: /\(Ola\s|^Sneaking\b/i, category: "Boosts & Sets" },
  { match: /\(Event ?Shop\s/i, category: "Boosts & Sets" },
  { match: /\(Summoning\s/, category: "Boosts & Sets" }, // Win Bonus
  // Tag-less
  { match: /^Smithing\b/i, category: "Boosts & Sets" },
];

export function classifyCategory(name: string): Category {
  for (const r of RULES) if (r.match.test(name)) return r.category;
  return "Other";
}

// Display order — Character first (player-controlled progression), then
// Worlds (system unlocks), then Boosts & Sets (meta bonuses), Other last.
export const CATEGORY_ORDER: Category[] = [
  "Character",
  "Worlds",
  "Boosts & Sets",
  "Other",
];

/** Wrap pool items into category sub-nodes. Each category node sums its
 *  members (for additive '+' fmt) and renders them as children. Used for
 *  the Main Additive Pool and LUK2 Additive Pool — NOT Post-Processing
 *  (which is order-sensitive). */
export function categorizePoolItems(items: CorganNode[]): CorganNode[] {
  const buckets = new Map<Category, CorganNode[]>();
  for (const it of items) {
    const cat = classifyCategory(it.name);
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(it);
  }
  const ordered: CorganNode[] = [];
  for (const cat of CATEGORY_ORDER) {
    const list = buckets.get(cat);
    if (!list || list.length === 0) continue;
    const sum = list.reduce((a, n) => a + (Number(n.val) || 0), 0);
    ordered.push({
      name: cat,
      val: sum,
      fmt: "+",
      children: list,
    });
  }
  return ordered;
}
