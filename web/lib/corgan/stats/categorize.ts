// ===== POOL CATEGORIZATION =====
// Group DR source rows by game system (Talents, Cards, Stamps, Alchemy,
// Farming, Equipment, …) so additive pools render as
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
  // Equipment / Boosts / Meta
  | "Equipment"
  | "Obols"
  | "Gallery"
  | "Hatrack"
  | "Golden Food"
  | "Set Bonuses"
  | "Bundles"
  | "Pristine Charms"
  | "Sneaking Mastery"
  | "Event Shop"
  | "Summoning"
  | "Other";

// Emoji prefix per category — used to decorate bucket headers in both
// the Additive Pool and the Post-Processing chain. Keeping the lookup
// here (not in DeepView) so the descriptor / categorizer is the single
// source of truth for category presentation.
export const SYSTEM_EMOJI: Record<SystemKey, string> = {
  "LUK / Stats": "🍀",
  Talents: "🎯",
  Cards: "🃏",
  "Star Signs": "⭐",
  Achievements: "🏆",
  Companions: "🐾",
  Friends: "🤝",
  Stamps: "📜",
  Alchemy: "⚗️",
  Sigils: "🔮",
  Prayers: "🙏",
  Shrines: "⛩️",
  Guild: "🛡️",
  Arcade: "🎮",
  Voting: "🗳️",
  "Post Office": "📮",
  "Shiny Pets": "🐉",
  Tome: "📖",
  Researching: "🔬",
  Chips: "💎",
  Dreams: "💭",
  "Cloud Bonus": "☁️",
  Owl: "🦉",
  Grimoire: "📕",
  Vault: "🏦",
  Farming: "🌾",
  Holes: "🕳️",
  Emperor: "👑",
  "Legend Talents": "⚔️",
  "Spelunk Shop": "🪨",
  Sushi: "🍣",
  Minehead: "⛏️",
  Button: "🔘",
  "Arcane Map": "🗺️",
  Glimbo: "🎲",
  Workshop: "🛠️",
  Equipment: "🎽",
  Obols: "🪙",
  Gallery: "🖼️",
  Hatrack: "🎩",
  "Golden Food": "🍔",
  "Set Bonuses": "🧰",
  Bundles: "🎁",
  "Pristine Charms": "🌟",
  "Sneaking Mastery": "🥷",
  "Event Shop": "🛍️",
  Summoning: "🐲",
  Other: "🔹",
};

/** Prefix a SystemKey label with its category emoji ("🃏 Cards"). */
export function decorateSystem(key: SystemKey): string {
  const e = SYSTEM_EMOJI[key];
  return e ? `${e} ${key}` : key;
}

/** Reverse of decorateSystem(): strip the emoji prefix from a bucket
 *  display name ("🃏 Cards" → "Cards"). Returns the SystemKey if the
 *  stripped string matches a known one, otherwise null. */
export function parseSystemFromBucketName(name: string): SystemKey | null {
  // Remove a leading emoji + space if present, then trim.
  const stripped = name.replace(/^\p{Extended_Pictographic}+️?\s+/u, "").trim();
  if (stripped in SYSTEM_EMOJI) return stripped as SystemKey;
  return null;
}

// -----------------------------------------------------------------------------
// World grouping — used by the Per World view in DeepView.
// Each system maps to a single "where it comes from" label. Unspecified
// systems fall back to "Other".
// -----------------------------------------------------------------------------

export type WorldKey =
  | "Global"
  | "Character"
  | "World 1"
  | "World 2"
  | "World 3"
  | "World 4"
  | "World 5"
  | "World 6"
  | "World 7"
  | "Other";

export const WORLD_ORDER: WorldKey[] = [
  "Global",
  "Character",
  "World 1",
  "World 2",
  "World 3",
  "World 4",
  "World 5",
  "World 6",
  "World 7",
  "Other",
];

export const WORLD_EMOJI: Record<WorldKey, string> = {
  Global: "🌐",
  Character: "👤",
  "World 1": "1️⃣",
  "World 2": "2️⃣",
  "World 3": "3️⃣",
  "World 4": "4️⃣",
  "World 5": "5️⃣",
  "World 6": "6️⃣",
  "World 7": "7️⃣",
  Other: "❓",
};

export const SYSTEM_WORLD: Record<SystemKey, WorldKey> = {
  // Global — account-wide systems
  Achievements: "Global",
  Friends: "Global",
  Guild: "Global",
  Vault: "Global",
  "Set Bonuses": "Global",
  Bundles: "Global",
  "Arcane Map": "Global",
  "Cloud Bonus": "Global",
  "Event Shop": "Global",

  // Character — class progression / character-bound bonuses
  "LUK / Stats": "Character",
  Talents: "Character",
  Cards: "Character",
  Equipment: "Character",
  Obols: "Character",
  "Star Signs": "Character",
  Grimoire: "Character",
  "Golden Food": "Character",
  Workshop: "Character",

  // World 1
  Companions: "World 1",
  Stamps: "World 1",
  Owl: "World 1",

  // World 2
  Alchemy: "World 2",
  Sigils: "World 2",
  Arcade: "World 2",
  Voting: "World 2",
  "Post Office": "World 2",

  // World 3
  Prayers: "World 3",
  Shrines: "World 3",
  Dreams: "World 3",
  Hatrack: "World 3",

  // World 4
  "Shiny Pets": "World 4",
  Tome: "World 4",
  Chips: "World 4",

  // World 5
  Holes: "World 5",

  // World 6
  Farming: "World 6",
  Emperor: "World 6",
  Summoning: "World 6",
  "Sneaking Mastery": "World 6",
  "Pristine Charms": "World 6",

  // World 7
  Researching: "World 7",
  "Legend Talents": "World 7",
  "Spelunk Shop": "World 7",
  Gallery: "World 7",
  Sushi: "World 7",
  Minehead: "World 7",
  Glimbo: "World 7",
  Button: "World 7",

  Other: "Other",
};

export function systemWorld(key: SystemKey): WorldKey {
  return SYSTEM_WORLD[key] ?? "Other";
}

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
  "Equipment",
  "Obols",
  "Gallery",
  "Hatrack",
  "Golden Food",
  "Set Bonuses",
  "Bundles",
  "Pristine Charms",
  "Sneaking Mastery",
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
  { match: /\(Bubble\s|\(Vial\s|Vial$|^Droppin Loads|^Shimmer/i, system: "Alchemy" },
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

  // ----- Equipment / Obols / Boosts / Meta -----
  // EtcBonuses(N) wrappers historically merged equipment + obol + nametag +
  // trophy + premhat into one bucket. We now split those sub-sources out
  // (see explodeEtcBonus below) so the categorizer sees the renamed
  // synthesized items directly — Equipment stays in its own bucket, Obols
  // lands in a sibling Obols bucket, Nametag/Trophy land in Gallery,
  // Hatrack gets its own. The wrapper-labelled rules below stay as
  // fallback for any path that still hands the categorizer an un-exploded
  // etcBonus item (they all route to Equipment as the legacy default).
  { match: /^Equipment\b/, system: "Equipment" },
  { match: /^Obols?\b/, system: "Obols" },
  {
    match:
      /^Drop Rate \(Equipment\)|^Bonus Drop Rate \(Equipment\)|^Drop Rate Multi \(Equipment\)|^Drop Chance \(Equipment\)/i,
    system: "Equipment",
  },
  { match: /\(EtcBonuses?\s|\(Etc\s|^EtcBonuses/, system: "Equipment" },
  // Gallery sub-sources (nametags + trophies — driven by Spelunk[16/17]
  // and gallery bonus multi).
  { match: /^Nametags?\b/i, system: "Gallery" },
  { match: /^Trophies\b|^Trophy\b/i, system: "Gallery" },
  // Hatrack (PremHat) sub-source.
  { match: /^Hatrack\b/i, system: "Hatrack" },
  { match: /\(Golden Food\s|\(GFood\s|^Golden Food/i, system: "Golden Food" },
  {
    match: /\(Smithing\s|\(Set Bonus\s|^Smithing\b/i,
    system: "Set Bonuses",
  },
  { match: /\(Bundle\s/, system: "Bundles" },
  { match: /\(Pristine\s|\(Pristine Charm\)/, system: "Pristine Charms" },
  { match: /\(Ola\s|^Sneaking\b/i, system: "Sneaking Mastery" },
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
    ordered.push({ name: decorateSystem(sys), val, fmt, children: list });
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
    out.push({ name: decorateSystem(currentSys), val, fmt, children: run });
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

/** EtcBonuses(N) wrappers from defs/drop-rate.ts come in as a single
 *  composite item that merges equipment + obol + nametag + trophy +
 *  premhat children. For categorization we want those sub-sources to
 *  land in DIFFERENT buckets (Equipment → Equipment, Obols → Obols, Nametag/Trophy
 *  → Gallery, Hatrack → Hatrack). Detect those wrappers and replace
 *  them with renamed per-source items so the classifier sees each
 *  branch independently.
 *
 *  Math note: the actual chain math in defs/drop-rate.ts uses the
 *  ORIGINAL wrapper.val (sum across all 5 sub-sources) so exploding
 *  here is display-only — it doesn't break the formula. The bucket
 *  summaries computed by summariseBucket() will treat each exploded
 *  piece as its own (1+v/100) factor, which is an illustrative
 *  per-category figure rather than the chain factor itself. */
function isEtcBonusWrapper(n: CorganNode): boolean {
  return /\(etcBonus\s+\d+(?:,\d+)*\)/.test(n.name);
}
function explodeEtcBonus(items: CorganNode[]): CorganNode[] {
  const out: CorganNode[] = [];
  for (const it of items) {
    if (!isEtcBonusWrapper(it) || !it.children || it.children.length === 0) {
      out.push(it);
      continue;
    }
    const idMatch = it.name.match(/\(etcBonus\s+(\d+(?:,\d+)*)\)/);
    const idTag = idMatch ? `(etcBonus ${idMatch[1]})` : "(etcBonus ?)";
    for (const child of it.children) {
      const cname = child.name;
      // Drop the safety-net placeholder — it doesn't carry any DR.
      if (cname === "No active sources") continue;
      let newName = cname;
      if (/^Equipment Bonuses/.test(cname)) newName = `Equipment ${idTag}`;
      else if (/^Obol Bonuses/.test(cname)) newName = `Obols ${idTag}`;
      else if (/^Nametag Bonuses/.test(cname)) newName = `Nametags ${idTag}`;
      else if (/^Trophy Bonuses/.test(cname)) newName = `Trophies ${idTag}`;
      else if (/^Hatrack Bonuses/.test(cname)) newName = `Hatrack ${idTag}`;
      out.push({ ...child, name: newName });
    }
  }
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
  const prepared = explodeEtcBonus(items);
  return strategy === "runs"
    ? categorizeRuns(prepared, mode)
    : categorizeMerged(prepared, mode);
}
