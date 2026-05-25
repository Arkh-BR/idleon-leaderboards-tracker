import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";

const g = globalThis as any;
if (!g.window) g.window = g;

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
loadSaveData(raw);

const hd = saveData.holesData;
console.log("holesData length:", hd.length);

const fountainUpgradeLevels = (hd as any)[31];
const fountainMarbleizeLevels = (hd as any)[32];
const braveryBonuses = (hd as any)[15];
const braveryMonument = (hd as any)[14];

console.log("\nbraveryMonument (hd[14]):", JSON.stringify(braveryMonument));
console.log(
  "\nbraveryBonuses (hd[15]) at idx 26 (DR), 29 (Wis), 9 (mon self):",
  braveryBonuses?.[26],
  braveryBonuses?.[29],
  braveryBonuses?.[9]
);

console.log("\nfountainUpgradeLevels (hd[31]):");
if (Array.isArray(fountainUpgradeLevels)) {
  for (let t = 0; t < fountainUpgradeLevels.length; t++) {
    const tier = fountainUpgradeLevels[t];
    if (Array.isArray(tier)) {
      const nonZero = tier
        .map((v: any, i: number) =>
          Number(v) > 0 ? `[${i}]=${v}` : null
        )
        .filter(Boolean)
        .join(" ");
      console.log(`  tier ${t}: ${nonZero || "(all zero)"}`);
    }
  }
}

console.log("\nfountainMarbleizeLevels (hd[32]):");
if (Array.isArray(fountainMarbleizeLevels)) {
  for (let t = 0; t < fountainMarbleizeLevels.length; t++) {
    const tier = fountainMarbleizeLevels[t];
    if (Array.isArray(tier)) {
      const nonZero = tier
        .map((v: any, i: number) =>
          Number(v) > 0 ? `[${i}]=${v}` : null
        )
        .filter(Boolean)
        .join(" ");
      console.log(`  tier ${t}: ${nonZero || "(all zero)"}`);
    }
  }
}
