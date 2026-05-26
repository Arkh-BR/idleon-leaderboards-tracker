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

function find(n: CorganNode, name: string): CorganNode | null {
  if (n.name === name) return n;
  for (const c of n.children || []) {
    const f = find(c, name);
    if (f) return f;
  }
  return null;
}

for (const poolName of ["Main Additive Pool", "LUK2 Additive Pool"]) {
  const pool = find(r.tree, poolName);
  if (!pool) continue;
  console.log(`\n=== ${pool.name} → ${pool.val.toFixed(2)} ===`);
  for (const cat of pool.children || []) {
    console.log(
      `  ${cat.name.padEnd(18)} → ${cat.val.toFixed(2).padStart(10)}  (${
        cat.children?.length ?? 0
      } sources)`
    );
  }
}

console.log("\nTotal DR:", r.total.toFixed(3));

// Confirm "Total Sum" exists
const ts = find(r.tree, "Total Sum");
console.log("Total Sum node:", ts?.name, "→", ts?.val.toFixed(4));

// Confirm guild label
const guild = find(r.tree, "Gold Charm (Guild 10)");
console.log("Gold Charm node found?", !!guild, guild ? "val=" + guild.val.toFixed(2) : "");

// Dump "Other" bucket contents so we can fix the classifier
for (const poolName of ["Main Additive Pool", "LUK2 Additive Pool"]) {
  const pool = find(r.tree, poolName);
  const other = pool?.children?.find((c) => c.name === "Other");
  if (other && other.children) {
    console.log(`\nOther in ${poolName}:`);
    for (const o of other.children) console.log("  " + o.name);
  }
}

