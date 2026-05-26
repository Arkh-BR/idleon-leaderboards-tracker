import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { companionBonus } from "../lib/corgan/stats/data/common/companions";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

const owned132 = saveData.companionIds?.has(132);
const owned26 = saveData.companionIds?.has(26);
const owned160 = saveData.companionIds?.has(160);
const owned50 = saveData.companionIds?.has(50);

console.log("Comp 132 owned:", owned132, "bonus:", owned132 ? companionBonus(132) : 0);
console.log("Comp 26 owned:", owned26, "bonus:", owned26 ? companionBonus(26) : 0);
console.log("Comp 160 owned:", owned160, "bonus:", owned160 ? companionBonus(160) : 0);
console.log("Comp 50 owned:", owned50, "bonus:", owned50 ? companionBonus(50) : 0);
