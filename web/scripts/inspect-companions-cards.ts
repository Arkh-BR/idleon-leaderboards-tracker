// Walk the DR tree and dump every Companion + Card leaf's display name and
// where it lives in the pool tree. Used to verify entity-names coverage and
// spot leaves still showing as "Companion 22" instead of a real name.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const result = computeCorganDropRate(save, 2, 0);

const POOL_NAMES = new Set([
  "Main Additive Pool",
  "LUK2 Additive Pool",
  "Post-Processing",
  "Chip Cap-Break",
  "LUK Scaling",
]);

type Leaf = { name: string; pool: string; val: number; note?: string };
const companions: Leaf[] = [];
const cards: Leaf[] = [];

function walk(n: CorganNode, path: string[]) {
  const parentName = path.length > 0 ? path[path.length - 1] : "";
  if (POOL_NAMES.has(parentName)) {
    const entry: Leaf = { name: n.name, pool: parentName, val: Number(n.val) || 0, note: n.note };
    if (/Companion|CompMulti/i.test(n.name)) companions.push(entry);
    if (/Card/i.test(n.name)) cards.push(entry);
    return;
  }
  for (const c of n.children || []) walk(c, [...path, n.name]);
}
walk(result.tree, []);

console.log("=== COMPANIONS ===");
for (const c of companions) {
  console.log(`  ${c.name.padEnd(60)} val=${c.val.toFixed(3)}${c.note ? "  (" + c.note + ")" : ""}`);
}
console.log();
console.log("=== CARDS ===");
for (const c of cards) {
  console.log(`  ${c.name.padEnd(60)} val=${c.val.toFixed(3)}${c.note ? "  (" + c.note + ")" : ""}`);
}
