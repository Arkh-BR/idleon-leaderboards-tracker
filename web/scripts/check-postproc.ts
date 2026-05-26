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

const pp = find(r.tree, "Post-Processing");
if (pp) {
  console.log("Post-Processing →", pp.val.toFixed(3) + "x");
  for (const c of pp.children || []) {
    console.log(
      `  ${c.name.padEnd(18)} → val=${Number(c.val).toFixed(3)} fmt=${c.fmt} (${c.children?.length ?? 0} items)`
    );
    for (const item of (c.children || []).slice(0, 6)) {
      console.log(
        `    • ${item.name.padEnd(60)} ${Number(item.val).toFixed(3)} fmt=${item.fmt}`
      );
    }
  }
}

console.log("\nTotal DR:", r.total.toFixed(3));
