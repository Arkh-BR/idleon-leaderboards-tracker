// ===== PER WORLD AUDIT =====
// Walks the live DR tree, classifies every category bucket into its
// world (Global / Character / W1–W7 / Other), and prints the grouping
// so we can sanity-check it against the user's spec.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import type { CorganNode } from "../lib/corgan/node";
import {
  parseSystemFromBucketName,
  systemWorld,
  WORLD_ORDER,
  WORLD_EMOJI,
  type SystemKey,
  type WorldKey,
} from "../lib/corgan/stats/categorize";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";
const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeCorganDropRate(raw, 2, 0);

type Row = {
  system: SystemKey;
  poolBadge: "Additive" | "Multi";
  node: CorganNode;
};

const rows: Row[] = [];
for (const child of r.tree.children || []) {
  if (child.name === "Additive Pool") {
    for (const bucket of child.children || []) {
      const sys = parseSystemFromBucketName(bucket.name);
      if (sys)
        rows.push({ system: sys, poolBadge: "Additive", node: bucket });
    }
  } else if (child.name === "Post-Processing") {
    for (const bucket of child.children || []) {
      const sys = parseSystemFromBucketName(bucket.name);
      if (sys) rows.push({ system: sys, poolBadge: "Multi", node: bucket });
    }
  }
}

console.log(`=== Per World grouping (${rows.length} buckets) ===\n`);
const byWorld = new Map<WorldKey, Row[]>();
for (const row of rows) {
  const w = systemWorld(row.system);
  if (!byWorld.has(w)) byWorld.set(w, []);
  byWorld.get(w)!.push(row);
}
for (const w of WORLD_ORDER) {
  const list = byWorld.get(w);
  if (!list || list.length === 0) continue;
  console.log(`${WORLD_EMOJI[w]} ${w}  (${list.length})`);
  for (const r of list) {
    const v = Number(r.node.val) || 0;
    const fmtSuffix = r.node.fmt === "x" ? "x" : "";
    console.log(
      `    ${r.poolBadge.padEnd(9)} ${r.node.name.padEnd(35)} ${v.toFixed(3)}${fmtSuffix}`
    );
  }
  console.log();
}

console.log(`Total DR: ${r.total.toFixed(3)}x`);
