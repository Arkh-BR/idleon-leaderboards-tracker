import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const save = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
const r = computeCorganDropRate(save, 2, 0);

function walk(n: CorganNode, path: string[]) {
  if (/Sneaking|Pristine Charm/i.test(n.name)) {
    console.log(n.name, "→", Number(n.val).toFixed(2), "  @", path.slice(-1).join(""));
  }
  for (const c of n.children || []) walk(c, [...path, n.name]);
}
walk(r.tree, []);

console.log("\nTotal DR:", r.total.toFixed(3));
