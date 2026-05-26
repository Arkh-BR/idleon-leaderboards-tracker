// Walk the DR tree, simulate the SystemView leaf collection + classification,
// and dump every leaf that falls into the "Other" bucket so we can spell out
// matchers for them in DeepView's SYSTEM_RULES.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const result = computeCorganDropRate(save, 2, 0);

// Mirror the production classifier in web/components/dropRate/DeepView.tsx.
// First try the entity-name "(System id)" tag, fall back to anchor regexes.
const TAG_TO_SYSTEM: Record<string, string> = {
  talent: "Talents", stamp: "Stamps", card: "Cards", cardset: "Cards",
  cardsingle: "Cards", prayer: "Prayers", shrine: "Shrines", arcade: "Arcade",
  achievement: "Achievements", "star sign": "Star Signs",
  "post office": "Post Office", vial: "Alchemy", bubble: "Alchemy",
  sigil: "Sigils", companion: "Companions", compmulti: "Companions",
  friend: "Friends", shiny: "Shiny Pets", tome: "Tomes", grid: "Grids/Lab",
  lab: "Grids/Lab", chip: "Chips", dream: "Dreams", "cloud bonus": "Cloud Bonus",
  cloudbonus: "Cloud Bonus", owl: "Owl", grimoire: "Grimoire", vault: "Vault",
  farm: "Farming", hole: "Holes", emperor: "Emperor", set: "Set Bonus",
  "set bonus": "Set Bonus", legend: "Legends", legendpts: "Legends",
  spelunk: "Spelunk Shop", spelunkshop: "Spelunk Shop", bundle: "Bundles",
  ola: "OLA", sneaking: "OLA", "arcane map": "Arcane Map",
  arcanemap: "Arcane Map", arcane: "Arcane Map", sushi: "Sushi",
  sushirog: "Sushi", minehead: "Minehead", pristine: "Pristine Charm",
  glimbo: "Glimbo", workshop: "Workshop", "event shop": "Event Shop",
  eventshop: "Event Shop", button: "Button", goldenfood: "Golden Food",
  "golden food": "Golden Food", gfood: "Golden Food", etcbonus: "ETC Bonus",
  etc: "ETC Bonus", voting: "Voting", guild: "Guild", "win bonus": "Win Bonus",
  winbonus: "Win Bonus", breeding: "Shiny Pets", summoning: "Win Bonus",
};

function extractSystemTag(name: string): string | null {
  const m = name.match(/\(([A-Za-z ]+?)\s+[\w,\-]+\)\s*$/);
  if (!m) return null;
  return m[1].toLowerCase().trim();
}

const RULES: Array<{ key: string; match: RegExp }> = [
  { key: "LUK / Stats", match: /^(LUK|Total LUK|Sub-1000|Over-1000)\b/i },
  { key: "Talents", match: /^Talent\b/i },
  { key: "Star Signs", match: /^(Star ?Signs?|Seraph)\b/i },
  { key: "Cards", match: /^(Card|CardSet|CardSingle)\b/i },
  { key: "Achievements", match: /^Achievement\b/i },
  { key: "Companions", match: /^(Companion|CompMulti)\b/i },
  { key: "Friends", match: /^Friend\b/i },
  { key: "Stamps", match: /^Stamp\b/i },
  { key: "Alchemy", match: /^(Bubble|Vial|Alchemy|DROPPIN|Cauldron|Atom)\b/i },
  { key: "Post Office", match: /^(Post ?Office|PO )\b/i },
  { key: "Arcade", match: /^Arcade\b/i },
  { key: "Voting", match: /^Voting\b/i },
  { key: "Sigils", match: /^Sigil\b/i },
  { key: "Prayers", match: /^Prayer\b/i },
  { key: "Shrines", match: /^Shrine\b/i },
  { key: "Guild", match: /^Guild\b/i },
  { key: "Shiny Pets", match: /^(Shiny|Breeding)\b/i },
  { key: "Tomes", match: /^Tome\b/i },
  { key: "Grids/Lab", match: /^(Grid|Lab)\b/i },
  { key: "Chips", match: /^Chip\b/i },
  { key: "Dreams", match: /^Dream\b/i },
  { key: "Cloud Bonus", match: /^(Cloud|CloudBonus)\b/i },
  { key: "Owl", match: /^(Owl|Summoning Owl)\b/i },
  { key: "Grimoire", match: /^Grimoire\b/i },
  { key: "Vault", match: /^Vault\b/i },
  { key: "Farming", match: /^(Farm|Farming|Crop|Exotic|Rank ?9)\b/i },
  { key: "Holes", match: /^(Hole|Cavern|Measurement|Meas|Monument|Upg ?\d)\b/i },
  { key: "Emperor", match: /^Emperor\b/i },
  { key: "Legends", match: /^Legend\b/i },
  { key: "Spelunk Shop", match: /^(Spelunk|Spelunking)\b/i },
  { key: "Sushi", match: /^(Sushi|SushiRoG|RoG)\b/i },
  { key: "Minehead", match: /^Minehead\b/i },
  { key: "Button", match: /^Button\b/i },
  { key: "Golden Food", match: /^(Golden Food|GFood|GoldenFood)\b/i },
  { key: "ETC Bonus", match: /^(ETC|EtcBonus|EtcBonuses|Etc)/i },
  { key: "Set Bonus", match: /^(Set Bonus|Smithing|Efaunt|Kattlekruk Set|SECRET_SET)\b/i },
  { key: "Bundles", match: /^(Bundle|Bun_)\b/i },
  { key: "Pristine Charm", match: /^Pristine\b/i },
  { key: "OLA", match: /^(OLA|Sneaking)\b/i },
  { key: "Event Shop", match: /^(Event ?Shop|EventShop)\b/i },
  { key: "Win Bonus", match: /^(Win ?Bonus|Summoning)\b/i },
  { key: "Glimbo", match: /^Glimbo\b/i },
  { key: "Workshop", match: /^Workshop\b/i },
  { key: "Arcane Map", match: /^(Arcane|ArcaneMap)\b/i },
];

function classify(name: string): string {
  const tag = extractSystemTag(name);
  if (tag) {
    const sys = TAG_TO_SYSTEM[tag];
    if (sys) return sys;
    const firstWord = tag.split(/\s+/)[0];
    if (TAG_TO_SYSTEM[firstWord]) return TAG_TO_SYSTEM[firstWord];
  }
  for (const r of RULES) if (r.match.test(name)) return r.key;
  return "Other";
}

// Mirror SystemView.collectLeaves(): pick nodes whose PARENT is one of the
// canonical pools. Those are the "source-level" entries the user sees as
// rows in By System.
const POOL_NAMES = new Set([
  "Main Additive Pool",
  "LUK2 Additive Pool",
  "Post-Processing",
  "Chip Cap-Break",
  "LUK Scaling",
]);

const leaves: { name: string; pool: string; val: number; note?: string }[] = [];
function walk(n: CorganNode, path: string[]) {
  const parentName = path.length > 0 ? path[path.length - 1] : "";
  if (POOL_NAMES.has(parentName)) {
    leaves.push({ name: n.name, pool: parentName, val: Number(n.val) || 0, note: n.note });
    return; // stop descending — children are sub-source breakdown
  }
  for (const c of n.children || []) walk(c, [...path, n.name]);
}
walk(result.tree, []);

const others = leaves.filter((l) => classify(l.name) === "Other");
console.log(`Total leaves: ${leaves.length}`);
console.log(`Classified as "Other": ${others.length}`);
console.log();
if (others.length > 0) {
  console.log("=== Other (need rules) ===");
  for (const o of others) {
    console.log(`  ${o.name.padEnd(60)} pool=${o.pool.padEnd(20)} val=${o.val.toFixed(3)}${o.note ? "  (" + o.note + ")" : ""}`);
  }
  console.log();
}

// Distribution by system
const dist = new Map<string, number>();
for (const l of leaves) {
  const k = classify(l.name);
  dist.set(k, (dist.get(k) ?? 0) + 1);
}
console.log("=== Distribution by System ===");
const sorted = Array.from(dist.entries()).sort((a, b) => b[1] - a[1]);
for (const [k, n] of sorted) {
  console.log(`  ${k.padEnd(20)} ${n}`);
}
