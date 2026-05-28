// Quick sanity check on the newly-added account-wide talents:
// for each, confirm talent.resolve auto-routes to max-mode and emits
// a "Reference Character" node inside Base Level.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { talent } from "../lib/corgan/stats/systems/common/talent";
import type { CorganNode } from "../lib/corgan/node";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

// 17 newly added + a couple controls (10/12 not account-wide, 328 already wired)
const NEW_IDS = [51, 52, 53, 54, 57, 178, 204, 205, 327, 370, 373, 430, 505, 535, 585, 595, 597];
const CONTROL_IDS = [10, 12, 328];

function findRefChar(n: CorganNode): CorganNode | null {
  if (n.name.startsWith("Reference Character:")) return n;
  if (!n.children) return null;
  for (const c of n.children) {
    const r = findRefChar(c);
    if (r) return r;
  }
  return null;
}

console.log("ID  | Name (from tree)                       | Val      | RefChar found?");
console.log("----|----------------------------------------|----------|----------------");

const ctx: any = { saveData, charIdx: 0, activeCharIdx: 0 };

for (const id of [...NEW_IDS, ...CONTROL_IDS]) {
  const tree = talent.resolve(id, ctx);
  const refChar = findRefChar(tree);
  const valStr = Number(tree.val).toFixed(3).replace(/\.?0+$/, "");
  const nameTrunc = tree.name.slice(0, 38).padEnd(38);
  console.log(
    `${String(id).padStart(4)}| ${nameTrunc} | ${valStr.padStart(8)} | ${refChar ? refChar.name : "(per-char emit)"}`
  );
}
