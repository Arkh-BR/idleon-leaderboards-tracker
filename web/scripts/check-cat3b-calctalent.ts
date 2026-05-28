import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { talent } from "../lib/corgan/stats/systems/common/talent";
import { computeCalcTalent } from "../lib/corgan/stats/systems/common/calcTalent";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

const IDS = [31, 57, 59, 110, 125, 146, 209, 305, 430, 470, 485, 595, 616, 620, 643, 644, 650, 656];
const nChars = (saveData as any).numCharacters || (saveData.charNames?.length ?? 10);

// 1) CalcTalentMAP[id] counter values (charIdx 0 as active char) ----------
console.log("=== CalcTalentMAP[id] counters (active char = 0) ===");
for (const id of IDS) {
  const v = computeCalcTalent(id, 0, saveData);
  console.log(`  MAP[${String(id).padStart(3)}] = ${v}`);
}

// 2) Resolve each talent across all chars; confirm finite + plausible ----
console.log("\n=== talent.resolve(id) across chars (headline val) ===");
let threw = 0;
let nonFinite = 0;
for (const id of IDS) {
  const vals: string[] = [];
  let fmt = "+";
  let note = "";
  for (let ci = 0; ci < nChars; ci++) {
    try {
      const tree = talent.resolve(id, { saveData, charIdx: ci, activeCharIdx: ci } as any);
      const val = Number(tree.val);
      fmt = (tree.fmt as string) || "+";
      if (ci === 0) note = String(tree.note || "");
      if (!Number.isFinite(val)) {
        nonFinite++;
        vals.push("NaN!");
      } else {
        vals.push(fmt === "x" ? val.toFixed(4) + "x" : "+" + val.toFixed(3));
      }
    } catch (e) {
      threw++;
      vals.push("THROW:" + (e as Error).message.slice(0, 40));
    }
  }
  console.log(
    `Tal ${String(id).padStart(3)} [${fmt}] | ` +
      vals.map((v) => v.padStart(11)).join(" ") +
      `\n        note(c0): ${note}`
  );
}

console.log(`\n=== Summary: ${IDS.length} talents, ${nChars} chars each ===`);
console.log(`  threw: ${threw}   non-finite: ${nonFinite}`);
console.log(threw === 0 && nonFinite === 0 ? "  ALL OK (no throws, all finite)" : "  PROBLEMS FOUND");
