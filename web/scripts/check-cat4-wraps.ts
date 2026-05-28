import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { talent } from "../lib/corgan/stats/systems/common/talent";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

// Newly-added Cat 4 ids in this wave.
const NEW = [101, 131, 295, 311, 461, 476, 313, 434, 282, 290];

const nChars = (saveData.charNames && saveData.charNames.length) || 10;
console.log(`Resolving ${NEW.length} new Cat 4 wraps across ${nChars} chars\n`);

let allFinite = true;
for (const id of NEW) {
  const vals: string[] = [];
  let fmt = "+";
  let note = "";
  for (let ci = 0; ci < nChars; ci++) {
    const ctx: any = { saveData, charIdx: ci, activeCharIdx: ci };
    let v: number;
    try {
      const tree = talent.resolve(id, ctx);
      v = Number(tree.val);
      fmt = tree.fmt || "+";
      if (ci === 0) note = tree.note || "";
    } catch (e) {
      allFinite = false;
      vals.push("THROW:" + (e as Error).message);
      continue;
    }
    if (!Number.isFinite(v)) allFinite = false;
    vals.push(fmt === "x" ? v.toFixed(4) + "x" : "+" + v.toFixed(3));
  }
  console.log(`Tal ${String(id).padStart(3)} [${fmt}] ${vals.join("  ")}`);
  console.log(`        note: ${note}`);
}

console.log("\nALL_FINITE_NO_THROW =", allFinite);
