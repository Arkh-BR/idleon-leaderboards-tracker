// Walk the DR tree and flag any node whose name still looks like a raw
// technical id (no friendly entity name plumbed through). The classifier
// works against patterns the previous fix-other-sources audit established;
// these are the rows that still read awkwardly in the UI.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const result = computeCorganDropRate(save, 2, 0);

// Patterns: a node looks "unnamed" when:
//   • It starts with a system word followed by a bare id (Farming rank9,
//     Cavern upg46, Spelunking 50, etc.), OR
//   • It carries a SCREAMING_SNAKE_CASE blob (KATTLEKRUK_SET), OR
//   • It's a generic descriptor wrapper that still leaks an id ("Card
//     Type 10", "Card Set 5") — wait, those got named, so we're hunting
//     residual rows like "Boss3B Card Bonus" etc.
const SUSPECT_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^Farming\s+\w+$/i, reason: "Farming wrapper" },
  { pattern: /^Cavern\s+upg/i, reason: "Cavern upgrade wrapper" },
  { pattern: /^Spelunking\s+\d+$/i, reason: "Spelunk shop entry" },
  { pattern: /^Measurement\s+\d+$/i, reason: "Hole measurement" },
  { pattern: /^Smithing\s+\w+$/i, reason: "Smithing set wrapper" },
  { pattern: /^RoG\s+Bonus\s+\d+$/i, reason: "Sushi RoG bonus" },
  { pattern: /^Breeding\s+\d+$/i, reason: "Breeding shiny" },
  { pattern: /^Summoning\s+\d+$/i, reason: "Summoning win" },
  { pattern: /^EtcBonuses?\([^)]+\)$/i, reason: "Unmapped EtcBonus" },
  { pattern: /^Boss\w+\s+Card\s+Bonus$/, reason: "Card-set inner bonus" },
  { pattern: /[A-Z]{4,}_[A-Z]+/, reason: "SCREAMING_SNAKE label" },
  { pattern: /^Equipment\w+$/, reason: "Raw item key (no display)" },
  { pattern: /^Obol\w+$/, reason: "Raw obol key" },
  { pattern: /^Trophy\d+/, reason: "Raw trophy key" },
  { pattern: /^Tag\s*#/, reason: "Raw nametag key" },
  { pattern: /^Companion\s+\d+$/, reason: "Companion missing real name" },
  { pattern: /^Bubble\s+\w+/i, reason: "Bubble key" },
  { pattern: /^Bun_/, reason: "Bundle key" },
  // Wrappers without an entity-name tag (no "(System id)" suffix) that look
  // like opaque labels.
];

type Finding = { name: string; depth: number; path: string; reason: string };
const findings: Finding[] = [];

function walk(n: CorganNode, depth: number, path: string[]) {
  const segment = n.name;
  const here = [...path, segment];
  // Skip "structural" nodes that aren't trying to name a game entity
  const STRUCTURAL = new Set([
    "Drop Rate",
    "Main Additive Pool",
    "LUK2 Additive Pool",
    "Post-Processing",
    "Chip Cap-Break",
    "LUK Scaling",
    "Personal",
    "Family",
    "Equipment Bonuses",
    "Obol Bonuses",
    "Nametag Bonuses",
    "Trophy Bonuses",
    "Hatrack Bonuses",
    "Available DR Items (not equipped)",
    "Available DR Obols (not equipped)",
    "× 1.4",
    "1 + (1.4·LUK + addSum) / 100",
  ]);
  if (!STRUCTURAL.has(segment)) {
    for (const { pattern, reason } of SUSPECT_PATTERNS) {
      if (pattern.test(segment)) {
        findings.push({
          name: segment,
          depth,
          path: here.join(" / "),
          reason,
        });
        break;
      }
    }
  }
  for (const c of n.children || []) walk(c, depth + 1, here);
}
walk(result.tree, 0, []);

// Deduplicate by name + reason
const seen = new Set<string>();
const unique = findings.filter((f) => {
  const k = f.reason + "::" + f.name;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`Total suspect rows: ${findings.length} (unique: ${unique.length})`);
console.log();
const byReason = new Map<string, Finding[]>();
for (const f of unique) {
  if (!byReason.has(f.reason)) byReason.set(f.reason, []);
  byReason.get(f.reason)!.push(f);
}
for (const [reason, list] of byReason) {
  console.log(`--- ${reason} (${list.length}) ---`);
  for (const f of list.slice(0, 8)) {
    console.log(`  ${f.name.padEnd(40)}  d${f.depth}  ${f.path}`);
  }
  if (list.length > 8) console.log(`  … +${list.length - 8} more`);
  console.log();
}
