// Try loading the bsguiler save and run the DR compute on each char to
// surface the failure mode. We try-catch each char so a single broken
// resolver doesn't mask the others.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\bsguiler.txt";

let save: any;
try {
  save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
} catch (e) {
  console.error("JSON parse failed:", e);
  process.exit(1);
}

console.log("charNames:", save.charNames);
console.log("save.data exists?", !!save.data);
console.log("Top-level keys (first 20):", Object.keys(save).slice(0, 20));
console.log();

for (let ci = 0; ci < (save.charNames?.length || 0); ci++) {
  try {
    const result = computeCorganDropRate(save, ci, 0);
    console.log(`Char ${ci} (${save.charNames[ci]}): DR=${result.total.toFixed(2)}`);
  } catch (e) {
    console.error(`Char ${ci} (${save.charNames[ci]}): FAILED`);
    console.error("  ", (e as Error).stack?.split("\n").slice(0, 8).join("\n   "));
    break;
  }
}
