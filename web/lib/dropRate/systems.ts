// The game systems a Drop Rate V1 row belongs to, and the buckets (🎯 Talents, 🃏 Cards...) the page groups the rows in. Used by the V1 tree (lib/game/trackers/dropRateV1.ts) and the
// page's Per World view (components/dropRate/DeepView.tsx); lib/arkh/stats/categorize re-exports it (Ruling B). A row's system is read from its name, so a name is part of the page's contract.
import type { ArkhNode } from "./node";

export type WorldKey = "Global" | "Character" | "World 1" | "World 2" | "World 3" | "World 4" | "World 5" | "World 6" | "World 7" | "Other";

export const WORLD_ORDER: WorldKey[] = ["Global", "Character", "World 1", "World 2", "World 3", "World 4", "World 5", "World 6", "World 7", "Other"];

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

/** Every system: its key, its emoji and where it comes from, in the order the merged buckets are shown. */
const SYSTEMS = [
  ["LUK / Stats", "🍀", "Character"],
  ["Talents", "🎯", "Character"],
  ["Cards", "🃏", "Character"],
  ["Star Signs", "⭐", "Character"],
  ["Achievements", "🏆", "Global"],
  ["Companions", "🐾", "World 1"],
  ["Friends", "🤝", "Global"],
  ["Stamps", "📜", "World 1"],
  ["Alchemy", "⚗️", "World 2"],
  ["Sigils", "🔮", "World 2"],
  ["Prayers", "🙏", "World 3"],
  ["Shrines", "⛩️", "World 3"],
  ["Guild", "🛡️", "Global"],
  ["Arcade", "🎮", "World 2"],
  ["Voting", "🗳️", "World 2"],
  ["Post Office", "📮", "World 2"],
  ["Shiny Pets", "🐉", "World 4"],
  ["Tome", "📖", "World 4"],
  ["Researching", "🔬", "World 7"],
  ["Chips", "💎", "World 4"],
  ["Dreams", "💭", "World 3"],
  ["Cloud Bonus", "☁️", "Global"],
  ["Owl", "🦉", "World 1"],
  ["Grimoire", "📕", "Character"],
  ["Vault", "🏦", "Global"],
  ["Farming", "🌾", "World 6"],
  ["Holes", "🕳️", "World 5"],
  ["Emperor", "👑", "World 6"],
  ["Legend Talents", "⚔️", "World 7"],
  ["Spelunk Shop", "🪨", "World 7"],
  ["Sushi", "🍣", "World 7"],
  ["Minehead", "⛏️", "World 7"],
  ["Button", "🔘", "World 7"],
  ["Menagerie", "🪼", "World 7"],
  ["Arcane Map", "🗺️", "Global"],
  ["Glimbo", "🎲", "World 7"],
  ["Workshop", "🛠️", "Character"],
  ["Equipment", "🎽", "Character"],
  ["Obols", "🪙", "Character"],
  ["Gallery", "🖼️", "World 7"],
  ["Hatrack", "🎩", "World 3"],
  ["Cape Vine", "🧣", "World 4"],
  ["Golden Food", "🍔", "Character"],
  ["Set Bonuses", "🧰", "Global"],
  ["Bundles", "🎁", "Global"],
  ["Pristine Charms", "🌟", "World 6"],
  ["Sneaking Mastery", "🥷", "World 6"],
  ["Event Shop", "🛍️", "Global"],
  ["Summoning", "🐲", "World 6"],
  ["Royal Guardian", "🏰", "Global"],
  ["Other", "🔹", "Other"],
] as const satisfies readonly (readonly [string, string, WorldKey])[];

export type SystemKey = (typeof SYSTEMS)[number][0];

export const SYSTEM_ORDER: SystemKey[] = SYSTEMS.map(([key]) => key);
export const SYSTEM_EMOJI = Object.fromEntries(SYSTEMS.map(([key, emoji]) => [key, emoji])) as Record<SystemKey, string>;
export const SYSTEM_WORLD = Object.fromEntries(SYSTEMS.map(([key, , world]) => [key, world])) as Record<SystemKey, WorldKey>;

export const systemWorld = (key: SystemKey): WorldKey => SYSTEM_WORLD[key] ?? "Other";

/** "🃏 Cards" from "Cards". */
export const decorateSystem = (key: SystemKey): string => `${SYSTEM_EMOJI[key]} ${key}`;

/** "Cards" from "🃏 Cards"; null when the name is no bucket. */
export function parseSystemFromBucketName(name: string): SystemKey | null {
  const key = name.replace(/^\p{Extended_Pictographic}+️?\s+/u, "").trim();
  return key in SYSTEM_EMOJI ? (key as SystemKey) : null;
}

/** The first rule whose pattern the row's name matches gives its system. */
const RULES: readonly (readonly [RegExp, SystemKey])[] = [
  [/^Royal (Statue|Guardian)\b/, "Royal Guardian"],
  [/\(Talent\s/, "Talents"],
  [/\(Card[A-Za-z]*\s|\(Card Type\s|\(Card Set\s/, "Cards"],
  [/\(Star ?Sign\s|^Star Signs?\b/i, "Star Signs"],
  [/\(Achievement\s/, "Achievements"],
  [/\(Companion\s|\(CompMulti\s/i, "Companions"],
  [/\(Friend\s|^Friend\b/i, "Friends"],
  [/^(LUK|Total LUK|Sub-1000|Over-1000)\b/i, "LUK / Stats"],
  [/\(Stamp\s/, "Stamps"],
  [/\(Bubble\s|\(Vial\s|Vial$|^Droppin Loads|^Shimmer/i, "Alchemy"],
  [/\(Sigil\s|Sigil$/i, "Sigils"],
  [/\(Post Office\s/i, "Post Office"],
  [/\(Arcade\s/, "Arcade"],
  [/\(Voting\s|^Voting\b/i, "Voting"],
  [/\(Prayer\s/, "Prayers"],
  [/\(Shrine\s/, "Shrines"],
  [/\(Guild\s/, "Guild"],
  [/\(Shiny\s|\(Breeding\s|^Breeding\b|Shiny Pet/i, "Shiny Pets"],
  [/\(Tome\s/, "Tome"],
  [/\(Grid\s|\(Lab\s/, "Researching"],
  [/\(Chip\s/, "Chips"],
  [/\(Dream\s|\(Dream Challenge\s/, "Dreams"],
  [/\(Cloud Bonus\s/i, "Cloud Bonus"],
  [/\(Owl\s|^Summoning Owl/i, "Owl"],
  [/\(Grimoire\s/, "Grimoire"],
  [/\(Vault\s/, "Vault"],
  [/\(Farming\s|^Farming\b|\(Exotic\s/i, "Farming"],
  [/\(Cavern\s|\(Measurement\s|\(Hole\s|\(Monument\s|^Monument\b|^Cavern\b|^Measurement\b/i, "Holes"],
  [/\(Emperor\s/, "Emperor"],
  [/\(Legend\s/, "Legend Talents"],
  [/\(Spelunking\s|^Spelunking\b/i, "Spelunk Shop"],
  [/\(RoG Bonus\s|\(Sushi\s/, "Sushi"],
  [/\(Minehead\s|^Minehead\b/i, "Minehead"],
  [/\(Button\s/, "Button"],
  [/^Menagerie\b/, "Menagerie"],
  [/^Arcane Map|^Arcane\b/i, "Arcane Map"],
  [/^Glimbo\b/i, "Glimbo"],
  [/^Workshop\b/i, "Workshop"],
  [/^Equipment\b/, "Equipment"],
  [/^Obols?\b/, "Obols"],
  [/^Drop Rate \(Equipment\)|^Bonus Drop Rate \(Equipment\)|^Drop Rate Multi \(Equipment\)|^Drop Chance \(Equipment\)/i, "Equipment"],
  [/\(EtcBonuses?\s|\(Etc\s|^EtcBonuses/, "Equipment"],
  [/^Nametags?\b/i, "Gallery"],
  [/^Trophies\b|^Trophy\b/i, "Gallery"],
  [/^Hatrack\b/i, "Hatrack"],
  [/^Cape Vine\b/i, "Cape Vine"],
  [/\(Golden Food\s|\(GFood\s|^Golden Food/i, "Golden Food"],
  [/\(Smithing\s|\(Set Bonus\s|^Smithing\b/i, "Set Bonuses"],
  [/\(Bundle\s/, "Bundles"],
  [/\(Pristine\s|\(Pristine Charm\)/, "Pristine Charms"],
  [/\(Ola\s|^Sneaking\b/i, "Sneaking Mastery"],
  [/\(Event ?Shop\s/i, "Event Shop"],
  [/\(Summoning\s|^Summoning\b|Summoning Win/i, "Summoning"],
];

export const classifySystem = (name: string): SystemKey => RULES.find(([pattern]) => pattern.test(name))?.[1] ?? "Other";

export type AggregateMode = "additive" | "multiplicative";

/** A bucket's headline: the sum of its rows, or in a multiplicative pool the product of what each multiplies by (a `+` row is a percentage). */
function bucketOf(system: SystemKey, rows: ArkhNode[], mode: AggregateMode): ArkhNode {
  const val =
    mode === "additive"
      ? rows.reduce((a, r) => a + (Number(r.val) || 0), 0)
      : rows.reduce((a, r) => {
          const v = Number(r.val) || 0;
          return a * (r.fmt === "x" ? v || 1 : 1 + v / 100);
        }, 1);
  return { name: decorateSystem(system), val, fmt: mode === "additive" ? "+" : "x", children: rows };
}

const ETC_PARTS: readonly (readonly [RegExp, string])[] = [
  [/^Equipment Bonuses/, "Equipment"],
  [/^Obol Bonuses/, "Obols"],
  [/^Nametag Bonuses/, "Nametags"],
  [/^Trophy Bonuses/, "Trophies"],
  [/^Hatrack Bonuses/, "Hatrack"],
  [/^Cape Vine Bonuses/, "Cape Vine"],
];

/**
 * An `... (etcBonus N)` row is one number the game adds up from the equipment, the obols, the Gallery, the Hatrack and the Cape Vine: its parts become rows of their own, each
 * named `<part> (etcBonus N)`, so they land in different buckets. A row with no parts stays as it is.
 */
function splitEtcBonus(rows: ArkhNode[]): ArkhNode[] {
  return rows.flatMap((row) => {
    const tag = /\(etcBonus \d+(?:,\d+)*\)/.exec(row.name)?.[0];
    if (!tag || !row.children?.length) return [row];
    return row.children.filter((part) => part.name !== "No active sources").map((part) => {
      const label = ETC_PARTS.find(([pattern]) => pattern.test(part.name))?.[1];
      return { ...part, name: label ? `${label} ${tag}` : part.name };
    });
  });
}

/**
 * The rows of a pool, grouped by system. "merge" joins every row of a system in one bucket, in SYSTEM_ORDER; "runs" groups only consecutive rows and keeps their sequence,
 * so a system can come back further down.
 */
export function categorizePoolItems(items: ArkhNode[], mode: AggregateMode = "additive", strategy: "merge" | "runs" = "merge"): ArkhNode[] {
  const rows = splitEtcBonus(items);
  if (strategy === "merge") {
    const by = new Map<SystemKey, ArkhNode[]>();
    for (const r of rows) by.set(classifySystem(r.name), [...(by.get(classifySystem(r.name)) ?? []), r]);
    return SYSTEM_ORDER.filter((s) => by.has(s)).map((s) => bucketOf(s, by.get(s)!, mode));
  }
  const out: ArkhNode[] = [];
  let run: ArkhNode[] = [];
  rows.forEach((row, i) => {
    run.push(row);
    const system = classifySystem(row.name);
    if (i + 1 === rows.length || classifySystem(rows[i + 1].name) !== system) {
      out.push(bucketOf(system, run, mode));
      run = [];
    }
  });
  return out;
}
