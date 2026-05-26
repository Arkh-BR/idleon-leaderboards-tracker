// Deeper audit: walks EVERY node in the tree (not just source-level rows)
// looking for labels that still read as raw ids or technical jargon.
// Distinct from audit-unnamed-nodes.ts which only checks immediate pool
// children — this one drills into sub-source breakdowns where wrappers
// like "Atom 12", "Compass 76", "Bubble 0,18", "OLA 232" still live.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeCorganDropRate(save, 2, 0);

// Names that LOOK like raw ids: System followed by an id with no friendly
// name in front. We exclude the well-known structural / sub-field labels.
const SUSPECT_PATTERNS: { p: RegExp; reason: string }[] = [
  { p: /^Atom \d+$/i, reason: "Atom collider node" },
  { p: /^Compass \d+/i, reason: "W6 Compass node" },
  { p: /^OLA \d+$/i, reason: "OLA bonus" },
  { p: /^Legend \d+$/i, reason: "Legend Talent" },
  { p: /^Mainframe \d+$/i, reason: "Lab mainframe" },
  { p: /^Pristine \d+$/i, reason: "Pristine charm" },
  { p: /^Sushi \d+$/i, reason: "Sushi RoG" },
  { p: /^Card w\w+$/i, reason: "Bare card key" },
  { p: /^Spelunk\[\d+\]/i, reason: "Spelunk-data ref" },
  { p: /^Bubble \d+/i, reason: "Bubble (cauldron,idx) ref" },
  { p: /^Bubble [A-Z]\d+$/i, reason: "Bubble by stat key" },
  { p: /^Exotic \d+$/i, reason: "Exotic crop" },
  { p: /^Grimoire \d+$/i, reason: "Grimoire upgrade" },
  { p: /^Vault \d+$/i, reason: "Vault upgrade" },
  { p: /^Talent \d+$/i, reason: "Bare talent id" },
  { p: /^Achievement \d+$/i, reason: "Bare achievement id" },
  { p: /^Killroy \d+$/i, reason: "Killroy" },
  { p: /^ClamWork \d+$/i, reason: "Clam Work" },
  { p: /^Pet\d+$/i, reason: "Pet id" },
  { p: /^Star Sign \d+$/i, reason: "Star sign id" },
];

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
  "Star Signs",
  "× 1.4",
  "1 + (1.4·LUK + addSum) / 100",
  "Base Level",
  "Bonus Levels",
  "Effective Level",
  "Bubble Level",
  "Card Lv",
  "Card Qty",
  "Per Star",
  "Per Skull",
  "Skulls Beaten",
  "Star Lv",
  "Spelunk 6th Star",
  "Rift 5th Star",
  "Bonus/Star",
  "Bonus/Lv",
  "Shop Level",
  "Per Level",
  "Card Qty",
  "Rank Level",
  "Ninja Base",
  "Tier",
  "Base",
  "Base Bonus",
  "Base Multiplier",
  "Base Doubler",
  "Cap",
  "Result",
  "Owned",
  "Equipped",
  "Completed",
  "Bonus",
  "Multi",
  "Multiplier",
  "Gallery Bonus Multi",
  "Hatrack Bonus Multi",
  "Gallery Level",
  "Hats Owned",
  "Crop Count",
  "Excess",
  "Stamp Level",
  "Formula Result",
  "Cosmo Bonus",
  "Cosmo Multiplier",
  "Meas Multi",
  "Measurement Level",
  "Best Character",
  "Best Mage Lv",
  "Bonus Level",
  "Shiny Lv",
  "Shiny EXP",
  "Cosmological Boost",
  "Currency Booster I",
  "Yellow Water",
  "QTY (type 10)",
  "Level Scaling",
  "Level Scale",
  "Prayer Level",
  "Plunderous Kills",
  "StampDoubler",
  "Slot 0",
  "Slot 1",
  "Slot 2",
  "Slot 3",
  "Slot 4",
  "Slot 5",
  "Slot 6",
  "Slot 7",
  "Slot 8",
  "Slot 9",
  "Slot 10",
  "Slot 11",
  "Slot 12",
  "Slot 13",
  "Slot 14",
  "Slot 15",
  "Slot 16",
  "Slot 17",
  "Slot 18",
  "Slot 19",
  "Slot 20",
  "Slot 21",
  "Slot 22",
  "Slot 23",
  "No active sources",
  "Talent Value",
  "Player Level",
  "Win Bonus Raw",
  "Task Shop",
  "Godshard Set",
]);

const seen = new Map<string, { reason: string; sample: string }>();

function walk(n: CorganNode, path: string[]) {
  const here = [...path, n.name];
  if (!STRUCTURAL.has(n.name)) {
    for (const { p, reason } of SUSPECT_PATTERNS) {
      if (p.test(n.name)) {
        if (!seen.has(n.name)) {
          seen.set(n.name, { reason, sample: here.join(" / ") });
        }
        break;
      }
    }
  }
  for (const c of n.children || []) walk(c, here);
}
walk(r.tree, []);

console.log(`Suspect node names: ${seen.size}`);
console.log();
const byReason = new Map<string, { name: string; sample: string }[]>();
for (const [name, { reason, sample }] of seen) {
  if (!byReason.has(reason)) byReason.set(reason, []);
  byReason.get(reason)!.push({ name, sample });
}
for (const [reason, list] of byReason) {
  console.log(`--- ${reason} (${list.length}) ---`);
  for (const f of list.slice(0, 10)) {
    console.log(`  ${f.name.padEnd(36)}  @ ${f.sample.slice(-100)}`);
  }
  console.log();
}
