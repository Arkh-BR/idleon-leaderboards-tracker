import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeCorganDropRate(save, 2, 0);

function dump(n: CorganNode, depth: number, maxDepth: number) {
  if (depth > maxDepth) return;
  const prefix = "  ".repeat(depth);
  const val = Number(n.val) || 0;
  const fmt = n.fmt === "x" ? "x" : n.fmt === "+" ? " " : " ";
  console.log(
    `${prefix}${n.name.padEnd(60 - depth * 2)} → ${val.toFixed(3)}${fmt}`
  );
  for (const c of n.children || []) dump(c, depth + 1, maxDepth);
}

dump(r.tree, 0, 2);
console.log("\n=== Post-Processing detail ===");
function find(n: CorganNode, name: string): CorganNode | null {
  if (n.name === name) return n;
  for (const c of n.children || []) {
    const f = find(c, name);
    if (f) return f;
  }
  return null;
}
const pp = find(r.tree, "Post-Processing");
if (pp) dump(pp, 0, 3);

console.log(`\nInitial × Chain = ${(1.533 * 82.227).toFixed(3)} (should ≈ 126.04)`);
console.log("\nTotal DR:", r.total.toFixed(3));
