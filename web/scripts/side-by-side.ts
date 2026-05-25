// Comparação 1:1 IT vs Corgan-port por source.
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
const { breakdown: it } = computeDropRateBreakdown(raw, 2);

loadSaveData(raw);
const ctx = {
  saveData,
  charIdx: 2,
  activeCharIdx: 2,
  mapBon: data.mapBonData,
  mapIdx: 2,
};
const tree = buildTree(dropRateDesc, getCatalog(), ctx);

function findChild(n: any, name: string): any {
  if (!n.children) return null;
  for (const c of n.children) if (c.name === name) return c;
  return null;
}
function deepFind(n: any, predicate: (c: any) => boolean): any {
  if (predicate(n)) return n;
  if (!n.children) return null;
  for (const c of n.children) {
    const f = deepFind(c, predicate);
    if (f) return f;
  }
  return null;
}

const itAdditive = (it as any).breakdown.categories[0].sources;
const itMulti = (it as any).breakdown.categories[1].sources;

console.log("=== IT ADDITIVE (in %) vs OUR POOLS (in raw, ÷100 = %) ===\n");
const itAddMap: Record<string, number> = {};
for (const s of itAdditive) itAddMap[s.name] = s.value;

const mainPool = findChild(tree, "Main Additive Pool");
const luk2Pool = findChild(tree, "LUK2 Additive Pool");
const ourSources: Record<string, number> = {};
for (const c of (mainPool?.children || []).concat(luk2Pool?.children || [])) {
  ourSources[c.name] = c.val || 0;
}

// Print ALL IT additive sources with their %
console.log("--- IT ADDITIVE ALL SOURCES (in %) ---");
let itSum = 0;
for (const s of itAdditive) {
  console.log(`  ${s.value.toFixed(3).padStart(10)}  ${s.name}`);
  itSum += s.value;
}
console.log(`  ----------`);
console.log(`  ${itSum.toFixed(3).padStart(10)}  TOTAL`);

console.log("\n--- ALL OUR ADDITIVE SOURCES (raw) ---");
const ourSorted = Object.entries(ourSources).sort(
  (a, b) => Math.abs(b[1]) - Math.abs(a[1])
);
for (const [n, v] of ourSorted) {
  if (Math.abs(v) > 0.5) {
    console.log(`  ${v.toFixed(2).padStart(10)}  ${n}`);
  }
}

const itTotal = (it as any).dropRate;
console.log(`\n=== TOTALS ===`);
console.log(`IT total       : ${itTotal.toFixed(2)}`);
console.log(`Our total (×arc): ${tree.val.toFixed(2)}`);

// Apply IT's arcaneMap factor manually to our base for fair comparison
const arc = deepFind(tree, (c) => c.note === "grid 168")
  ? 1.244
  : 1.0; // glimbo
console.log(`Note: IT excludes Froggy arcaneMap; our total includes it.`);

const postProc = findChild(tree, "Post-Processing");
console.log(`\n=== POSTMULT BREAKDOWN ===`);
const itMultMap: Record<string, number> = {};
for (const m of itMulti) itMultMap[m.name] = m.value;
console.log("IT source                  | IT value  | Ours");
console.log("-".repeat(70));
let itPostProduct = 1;
for (const m of itMulti) {
  // IT's multiplicative items: some are raw multipliers (Siege Breaker, Glimbo, Mallay, Glunko, Santa)
  // others are increments (Tesseract, Card Multi, Tome, Minehead, Charm)
  const isRawMult = ["Siege Breaker", "Glimbo DR", "Mallay", "Glunko The Massive", "Santa Snake"]
    .includes(m.name);
  const eff = isRawMult ? m.value : 1 + m.value;
  itPostProduct *= eff;
  console.log(`${m.name.padEnd(28)} | ${(m.value).toFixed(3).padStart(8)} | eff ${eff.toFixed(3)}`);
}
const bunV = false; // need to check
console.log(`\nIT postMult product: ${itPostProduct.toFixed(3)}x`);
console.log("\n--- Our postMult children ---");
for (const c of postProc?.children || []) {
  const eff = c.fmt === "x" ? c.val : 1 + (c.val || 0) / 100;
  console.log(`  ${eff.toFixed(3).padStart(8)}x  ${c.name}  (raw ${(c.val || 0).toFixed(2)})`);
}
