import { readFileSync } from "node:fs";
import { computeArkhDropRate } from "../lib/arkh/computeDR";
import type { ArkhNode } from "../lib/arkh/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeArkhDropRate(save, 2, 0);

function find(n: ArkhNode, name: string): ArkhNode | null {
  if (n.name === name) return n;
  for (const c of n.children || []) {
    const f = find(c, name);
    if (f) return f;
  }
  return null;
}

const gbm = find(r.tree, "Gallery Bonus Multi");
if (gbm) {
  console.log("Gallery Bonus Multi → " + gbm.val.toFixed(3));
  for (const c of gbm.children || []) {
    console.log("  " + c.name + "  // " + (c.note || ""));
  }
}

const hbm = find(r.tree, "Hatrack Bonus Multi");
if (hbm) {
  console.log("\nHatrack Bonus Multi → " + hbm.val.toFixed(3));
  for (const c of hbm.children || []) {
    console.log("  " + c.name + "  // " + (c.note || ""));
  }
}
