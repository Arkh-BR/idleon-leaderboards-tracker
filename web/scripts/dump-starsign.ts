import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeCorganDropRate(save, 2, 0);

function find(n: CorganNode, name: string): CorganNode | null {
  if (n.name === name) return n;
  for (const c of n.children || []) {
    const f = find(c, name);
    if (f) return f;
  }
  return null;
}

const s = find(r.tree, "Star Signs");
if (s) {
  console.log(s.name, "→", s.val.toFixed(3));
  for (const c of s.children || []) {
    console.log("  " + c.name, "→", Number(c.val).toFixed(3));
  }
}
