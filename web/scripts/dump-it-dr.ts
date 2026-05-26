// Run IT's getDropRate on zArkh's save and print the result.
// Helps identify whether the 17% gap (Corgan 53370 vs in-game 62400) comes
// from something IT computes that Corgan/we miss.

import { readFileSync } from "node:fs";
import "../lib/it/polyfills.js";
import { parseData } from "../lib/it/parsers";
import { getDropRate } from "../lib/it/parsers/character";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);

const charNames = raw.charNames || [];
const account: any = parseData(raw, charNames);
const characters = account?.characters || [];
const char = characters[2];
if (!char) {
  console.error("Char 2 not found. Available chars:", characters.map((c: any) => c?.name));
  process.exit(1);
}

console.log("Char name:", char.name);
console.log("Char class:", char.class);
console.log("Char level:", char.level);
console.log("LUK:", char.stats?.luck);

const dr = getDropRate(char, account, characters);
console.log("\nIT getDropRate result:");
console.log("  dropRate (final):", dr.dropRate);
if (dr.breakdown?.categories) {
  for (const cat of dr.breakdown.categories) {
    console.log(`\n  ${cat.name}:`);
    for (const s of cat.sources || []) {
      console.log(`    ${s.name}: ${s.value}`);
    }
  }
}
