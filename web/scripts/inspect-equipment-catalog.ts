// Walk the DR tree and dump the contents of each etcBonus node so we can
// verify the catalog of unequipped DR items shows up under each stat type
// (DROP_RATE / DROP_CHANCE / BONUS_DROP_RATE / DROP_RATE_MULTI).

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const result = computeCorganDropRate(save, 2, 0);

function find(n: CorganNode, predicate: (x: CorganNode) => boolean, out: CorganNode[]) {
  if (predicate(n)) out.push(n);
  for (const c of n.children || []) find(c, predicate, out);
}

const etcNodes: CorganNode[] = [];
find(result.tree, (n) => /^EtcBonuses\(/.test(n.name), etcNodes);

for (const e of etcNodes) {
  console.log(`\n=== ${e.name} (val=${e.val.toFixed(2)}) ===`);
  function dump(n: CorganNode, depth: number, maxDepth: number) {
    if (depth > maxDepth) return;
    const prefix = "  ".repeat(depth);
    const val = Number(n.val) || 0;
    const valStr = val.toFixed(3);
    console.log(`${prefix}${n.name} → ${valStr}${n.note ? "  // " + n.note : ""}`);
    for (const c of n.children || []) dump(c, depth + 1, maxDepth);
  }
  dump(e, 0, 4);
}
