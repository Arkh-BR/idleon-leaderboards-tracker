import { ChipDesc } from "../lib/corgan/stats/data/game/customlists.js";
import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { detectChip16 } from "../lib/corgan/stats/systems/w7/gallery";
import * as data from "../lib/corgan/save/data";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

const cd = ChipDesc as any;
console.log("Chips with slot-doubling effects (pend/key1/troph):");
for (let i = 0; i < cd.length; i++) {
  const k = cd[i]?.[10];
  if (k && ["troph", "pend", "key1"].includes(k)) {
    console.log(`  ChipDesc[${i}]: "${k}" - ${cd[i][0]}`);
  }
}

console.log("\nzArkhe (char 2) lab chips:");
const lab = data.labData as any;
if (lab && lab[3]) {
  for (let s = 0; s < lab[3].length; s++) {
    const chipId = lab[3][s];
    if (chipId > 0 && cd[chipId]) {
      console.log(`  slot ${s}: chip ${chipId} = ${cd[chipId][0]} (effect=${cd[chipId][10]})`);
    }
  }
}
