// Dump every node of the Drop Rate tree in a flat list so we can compare
// values against in-game UI source-by-source.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { buildTree } from "../lib/corgan/stats/tree-builder";
import { getCatalog } from "../lib/corgan/stats/registry";
import dropRateDesc from "../lib/corgan/stats/defs/drop-rate";
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

const ctx = {
  saveData,
  charIdx: 2,
  activeCharIdx: 2,
  mapBon: data.mapBonData,
  mapIdx: 2,
  chipGalleryActive: true,
};
const tree = buildTree(dropRateDesc, getCatalog(), ctx);

function fmtVal(v: any, fmt: any): string {
  if (typeof v !== "number") return String(v);
  if (fmt === "x") return v.toFixed(6) + "x";
  if (fmt === "+") return (v >= 0 ? "+" : "") + v.toFixed(4);
  if (Math.abs(v) >= 1e3) return v.toFixed(2);
  return v.toFixed(6);
}

// ============================================================
// Print top-level pools first
// ============================================================
console.log("=".repeat(80));
console.log("ZARKHE @ FROGGY FIELDS — DR BREAKDOWN");
console.log("=".repeat(80));
console.log(`TOP-LEVEL DR = ${tree.val.toFixed(4)}x`);
console.log("");

function findNode(n: any, name: string): any {
  if (n.name === name) return n;
  for (const c of n.children || []) {
    const r = findNode(c, name);
    if (r) return r;
  }
  return null;
}

const luk = findNode(tree, "LUK Scaling");
const main = findNode(tree, "Main Additive Pool");
const luk2 = findNode(tree, "LUK2 Additive Pool");
const chip = findNode(tree, "Chip Cap-Break");
const post = findNode(tree, "Post-Processing");

console.log("--- TOP POOLS ---");
console.log(`LUK Scaling:       ${luk?.val.toFixed(6)}`);
console.log(`Main Additive Pool: ${main?.val.toFixed(4)}`);
console.log(`LUK2 Additive Pool: ${luk2?.val.toFixed(4)}`);
console.log(`Chip Cap-Break:    ${chip?.val.toFixed(4)}`);
console.log(`Post-Processing:   ${post?.val.toFixed(6)}x`);
console.log("");

// ============================================================
// Main Additive Pool — list each source
// ============================================================
console.log("--- MAIN ADDITIVE POOL ITEMS ---");
let mainTotal = 0;
for (const c of main?.children || []) {
  mainTotal += c.val;
  console.log(`  ${c.name.padEnd(50)} ${fmtVal(c.val, c.fmt)}`);
}
console.log(`  ${"TOTAL".padEnd(50)} ${mainTotal.toFixed(4)}`);
console.log("");

// ============================================================
// LUK2 Additive Pool
// ============================================================
console.log("--- LUK2 ADDITIVE POOL ITEMS ---");
let luk2Total = 0;
for (const c of luk2?.children || []) {
  luk2Total += c.val;
  console.log(`  ${c.name.padEnd(50)} ${fmtVal(c.val, c.fmt)}`);
}
console.log(`  ${"TOTAL".padEnd(50)} ${luk2Total.toFixed(4)}`);
console.log("");

// ============================================================
// Post-Processing chain
// ============================================================
console.log("--- POST-PROCESSING CHAIN ---");
for (const c of post?.children || []) {
  console.log(`  ${c.name.padEnd(50)} ${fmtVal(c.val, c.fmt)}  ${c.note ? "// " + c.note : ""}`);
}
console.log("");

// ============================================================
// Replay the in-game cascade with our values for diagnostic
// ============================================================
console.log("--- CASCADE REPLAY (N.js order) ---");
const lukVal = luk!.val;
const addSum = (main?.val || 0) + (luk2?.val || 0);
const base = 1 + (1.4 * lukVal + addSum) / 100;
console.log(`base = 1 + (1.4 * ${lukVal.toFixed(4)} + ${addSum.toFixed(2)}) / 100 = ${base.toFixed(4)}`);

const postChildren = post?.children || [];
let cur = base;
console.log(`  Step 0: base = ${cur.toFixed(4)}`);
for (let i = 0; i < postChildren.length; i++) {
  const c = postChildren[i];
  let prev = cur;
  if (c.fmt === "x") {
    cur = cur * (c.val || 1);
  } else if (c.fmt === "+") {
    cur = cur + (c.val || 0);
  } else {
    cur = cur * (1 + (c.val || 0) / 100);
  }
  console.log(
    `  Step ${i + 1}: ${c.name.padEnd(45)} ${prev.toFixed(2)} → ${cur.toFixed(2)} (Δ ${(cur - prev).toFixed(2)}, ${c.fmt === "x" ? "×" : c.fmt === "+" ? "+" : "+%"}${c.val?.toFixed?.(4) ?? c.val})`
  );
}
console.log(`FINAL via replay: ${cur.toFixed(4)}`);
console.log(`In-game target:   62744.4300`);
console.log(`Gap:              ${(62744.43 - cur).toFixed(4)} (${((62744.43 - cur) / 62744.43 * 100).toFixed(3)}%)`);
