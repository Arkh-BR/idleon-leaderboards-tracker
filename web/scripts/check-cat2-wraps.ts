import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { talent } from "../lib/corgan/stats/systems/common/talent";
import { TALENT_FINAL_BONUS_WRAPS } from "../lib/corgan/stats/data/common/talent-final-bonus-wraps";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

const ids = Object.keys(TALENT_FINAL_BONUS_WRAPS).map(Number).sort((a, b) => a - b);

console.log("Talent | Headline Val | fmt | Note");
console.log("-------|--------------|-----|-----");

const ctx: any = { saveData, charIdx: 0, activeCharIdx: 0 };
for (const id of ids) {
  const tree = talent.resolve(id, ctx);
  const val = Number(tree.val);
  const valStr = (tree.fmt === "x" ? val.toFixed(4) + "x" : "+" + val.toFixed(3)).padStart(12);
  console.log(`${String(id).padStart(6)} | ${valStr} | ${(tree.fmt || "+").padStart(3)} | ${tree.note || ""}`);
}
