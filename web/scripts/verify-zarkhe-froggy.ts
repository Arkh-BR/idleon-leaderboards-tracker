// Smoke test: zArkhe (char 2) on Froggy Fields (map 2) — user reports
// in-game DR = 62399.97. Compare IT-port + Corgan-port outputs.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import { loadSaveData as itLoadStub } from "../lib/corgan/save/loader";
import { saveData as corganSave } from "../lib/corgan/state";
import { arcaneFactor, buildMapOptions } from "../lib/dropRate/arcaneBonus";

// Polyfill window for IT's getDropRate (uses window.gtag in error catch)
const g = globalThis as any;
if (!g.window) g.window = g;

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const charIdx = 2;  // zArkhe
const mapIdx = 2;   // Froggy Fields

// Map kills inspection — MapBon is a flat CSV string in raw saves
const mapBonStr = String(raw.data.MapBon || "");
const flat = mapBonStr.split(",").map((s: string) => Number(s) || 0);
const mb: number[][] = [];
for (let i = 0; i + 2 < flat.length; i += 3) mb.push([flat[i], flat[i + 1], flat[i + 2]]);
const fkills = mb[mapIdx]?.[0] || 0;
console.log(`mapBon[${mapIdx}] (Froggy Fields) kills = ${fkills}`);
console.log(`arcaneFactor (IT impl) = ${arcaneFactor(fkills).toFixed(4)}x\n`);

// === Corgan tree ===
itLoadStub(raw);
console.log(`[debug] saveData.mapBonData.length = ${corganSave.mapBonData?.length}`);
console.log(`[debug] saveData.mapBonData[2] = ${JSON.stringify(corganSave.mapBonData?.[2])}`);
const { tree: corganTree, total: corganTotal } = computeCorganDropRate(raw, charIdx, mapIdx);

console.log(`[corgan] zArkhe DR on map ${mapIdx} = ${corganTotal.toFixed(2)}x`);
console.log(`[user expected]                       = 62399.97x`);
console.log(`[delta]                               = ${(corganTotal - 62399.97).toFixed(2)} (${((corganTotal / 62399.97 - 1) * 100).toFixed(1)}%)\n`);

// Print top-level pool values to compare
function printNode(n: any, depth = 0, max = 1) {
  if (depth > max) return;
  const indent = "  ".repeat(depth);
  const v =
    typeof n.val === "number"
      ? n.fmt === "x"
        ? n.val.toFixed(3) + "x"
        : n.fmt === "+"
          ? (n.val >= 0 ? "+" : "") + n.val.toFixed(3)
          : n.val.toFixed(3)
      : String(n.val);
  console.log(`${indent}${n.name.padEnd(28 - depth * 2)} ${v}` + (n.note ? `  (${n.note})` : ""));
  if (n.children && depth < max) {
    for (const c of n.children) printNode(c, depth + 1, max);
  }
}

printNode(corganTree, 0, 1);

// Find arcaneMap node
function findNode(n: any, name: string): any {
  if (n.name?.includes(name)) return n;
  if (!n.children) return null;
  for (const c of n.children) {
    const f = findNode(c, name);
    if (f) return f;
  }
  return null;
}
const arc = findNode(corganTree, "Arcane Map Bonus");
console.log(`\n[arcaneMap node]`);
if (arc) {
  console.log(`  val = ${arc.val.toFixed(3)} (fmt=${arc.fmt})`);
  for (const c of arc.children || []) {
    console.log(`    ${c.name.padEnd(24)} ${typeof c.val === 'number' ? c.val.toFixed(3) : c.val}`);
  }
} else {
  console.log("  (not found)");
}
