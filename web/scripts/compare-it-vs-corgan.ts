// Comparação source-by-source: IT-port vs Corgan-port para zArkhe / Froggy
// para identificar quais sources do nosso Corgan-port estão divergindo
// e por quanto. In-game DR real: 62400x.

import { readFileSync } from "node:fs";
import { computeDropRateBreakdown } from "../lib/dropRate/breakdown";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { buildTree } from "../lib/corgan/stats/tree-builder";
import { getCatalog } from "../lib/corgan/stats/registry";
import dropRateDesc from "../lib/corgan/stats/defs/drop-rate";
import * as data from "../lib/corgan/save/data";

const g = globalThis as any;
if (!g.window) g.window = g;

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const charIdx = 2;
const mapIdx = 2;

// === IT-port ===
const { breakdown: it } = computeDropRateBreakdown(raw, charIdx);
console.log("=== IT-port breakdown (zArkhe) ===");
console.log("Total drop rate:", (it as any)?.total || (it as any));
console.log("\nFull IT breakdown object keys:", Object.keys(it || {}));
console.log("\nFull IT object (formatted):");
console.log(JSON.stringify(it, null, 2).slice(0, 4000));

// === Corgan-port ===
console.log("\n\n=== Corgan-port ===");
loadSaveData(raw);
const ctx = {
  saveData,
  charIdx,
  activeCharIdx: charIdx,
  mapBon: data.mapBonData,
  mapIdx,
};
const tree = buildTree(dropRateDesc, getCatalog(), ctx);
console.log("Total:", tree.val.toFixed(2));

function findChild(n: any, name: string): any {
  if (!n.children) return null;
  for (const c of n.children) if (c.name === name) return c;
  return null;
}

for (const poolName of ["Main Additive Pool", "LUK2 Additive Pool"]) {
  const pool = findChild(tree, poolName);
  if (!pool) continue;
  console.log(`\n${poolName} (sum=${pool.val.toFixed(2)}):`);
  const sorted = (pool.children || [])
    .slice()
    .sort((a: any, b: any) => Math.abs(b.val || 0) - Math.abs(a.val || 0));
  for (const c of sorted) {
    console.log(
      `  ${(c.val || 0).toFixed(2).padStart(10)}  ${c.name}${c.note ? "  (" + c.note + ")" : ""}`
    );
  }
}

const post = findChild(tree, "Post-Processing");
if (post) {
  console.log(`\nPost-Processing (val=${post.val.toFixed(3)}x):`);
  const sorted = (post.children || []).slice().sort((a: any, b: any) => {
    const av = a.fmt === "x" ? a.val : 1 + (a.val || 0) / 100;
    const bv = b.fmt === "x" ? b.val : 1 + (b.val || 0) / 100;
    return bv - av;
  });
  for (const c of sorted) {
    const eff = c.fmt === "x" ? c.val : 1 + (c.val || 0) / 100;
    console.log(
      `  ${eff.toFixed(3).padStart(8)}x  ${c.name}  (raw ${(c.val || 0).toFixed(2)} fmt=${c.fmt})`
    );
  }
}
