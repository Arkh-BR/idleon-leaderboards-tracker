// Mimics the React DrCalculator chip detection logic exactly.
import { readFileSync } from "node:fs";

const text = readFileSync(
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
  "utf8"
);
const save = JSON.parse(text);

// === React detection (DrCalculator.tsx) ===
const data = (save as any)?.data ?? save;
let lab: any = data.Lab;
console.log("type of data.Lab:", typeof lab);
if (typeof lab === "string") {
  console.log("  string head:", lab.slice(0, 80));
  try {
    lab = JSON.parse(lab);
    console.log("  parsed OK, type after:", Array.isArray(lab) ? "array" : typeof lab);
  } catch {
    lab = null;
  }
}
let found = { detected: false, charIdx: -1, slot: -1 };
if (Array.isArray(lab)) {
  console.log("lab.length:", lab.length);
  for (let ci = 0; ci < 10; ci++) {
    const slots = lab[1 + ci];
    if (!Array.isArray(slots)) {
      console.log(`  lab[${1 + ci}] is not an array (type=${typeof slots})`);
      continue;
    }
    console.log(`  lab[${1 + ci}] (char ${ci}):`, slots);
    for (let s = 0; s < 7; s++) {
      if (Number(slots[s]) === 16) {
        found = { detected: true, charIdx: ci, slot: s };
        break;
      }
    }
    if (found.detected) break;
  }
}
console.log("");
console.log("FOUND:", found);
