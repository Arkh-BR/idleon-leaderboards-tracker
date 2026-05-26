// Smoke test: load a real save, compute the DR tree, walk it, and verify
// every leaf name has a human-friendly form (no bare "Talent 279" labels)
// for the systems we expect to be covered.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const result = computeCorganDropRate(save, 2, 0); // zArkhe is char 2

console.log(`Total DR: ${result.total.toFixed(3)}x`);
console.log();

// Walk the tree and look for any name that's still in raw "Talent 279" form
// — those would indicate we missed plumbing entity-names through that path.
const rawPattern = /^(Talent|Stamp|Card|Prayer|Shrine|Achievement|Star Sign|Arcade|Owl|Vial|Bubble) \d+$|^(Stamp|Card) [A-Z]+\w*$/;
const findings: { path: string; name: string }[] = [];

function walk(n: CorganNode, path: string[]) {
  const here = [...path, n.name];
  if (rawPattern.test(n.name)) {
    findings.push({ path: here.join(" / "), name: n.name });
  }
  for (const c of n.children || []) walk(c, here);
}
walk(result.tree, []);

console.log(`Total nodes walked.`);
console.log(`Bare-id labels remaining: ${findings.length}`);
if (findings.length > 0) {
  console.log("\nSample of first 10:");
  for (const f of findings.slice(0, 10)) {
    console.log(`  ${f.name} (${f.path})`);
  }
}

// Sample a few specific nodes to confirm they read well
console.log("\n--- Sample of named nodes ---");
function printFirst(n: CorganNode, depth: number, maxRows: { n: number }) {
  if (maxRows.n <= 0) return;
  if (!/^(Drop Rate|×|1 \+|Post-Processing|Main Additive Pool|LUK2 Additive Pool|Chip|LUK)/.test(n.name)) {
    console.log("  " + "  ".repeat(depth) + n.name + " → " + Number(n.val).toFixed(2));
    maxRows.n--;
  }
  for (const c of n.children || []) printFirst(c, depth + 1, maxRows);
}
printFirst(result.tree, 0, { n: 30 });
