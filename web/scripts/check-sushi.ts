import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { ROG_BONUS_QTY, ROG_DESC } from "../lib/corgan/stats/data/w7/sushi";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

console.log("uniqueSushi:", saveData.cachedUniqueSushi);
console.log("");
console.log("Searching for 'Gallery' in ROG_DESC...");
for (let i = 0; i < ROG_DESC.length; i++) {
  if (ROG_DESC[i] && ROG_DESC[i].toLowerCase().includes("gallery")) {
    console.log(`  [${i}] desc="${ROG_DESC[i]}" val=${ROG_BONUS_QTY[i]}`);
  }
}
console.log("");
console.log("Index 54:");
console.log(`  desc="${ROG_DESC[54]}"`);
console.log(`  val=${ROG_BONUS_QTY[54]}`);
console.log(`  unlocked=${(saveData.cachedUniqueSushi || 0) > 54}`);
