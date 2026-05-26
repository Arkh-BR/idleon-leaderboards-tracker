// Verify the path scheme used at snapshot time (treeFlatten.flattenTree)
// matches the path scheme used at render time (DeepView's nodePath via
// the same helper). Specifically: every bucket path that the Per World
// view computes for a fresh tree should resolve in the flattened map.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import {
  flattenTree,
  nodePath,
} from "../lib/dropRate/treeFlatten";
import { parseSystemFromBucketName } from "../lib/corgan/stats/categorize";
import type { CorganNode } from "../lib/corgan/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";
const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeCorganDropRate(raw, 2, 0);

const flat = flattenTree(r.tree);
const flatKeys = Object.keys(flat);
console.log(`Flat tree has ${flatKeys.length} entries\n`);

// Replicate the Per World path-collection logic and confirm every path
// resolves in flat[].
type BucketProbe = {
  pool: "Additive" | "Multi";
  bucketName: string;
  bucketPath: string;
  bucketVal: number;
};
const probes: BucketProbe[] = [];
const root = r.tree as CorganNode;
const rootPath = nodePath("", root, [root], 0);
const parentChildren = root.children || [];
for (let pi = 0; pi < parentChildren.length; pi++) {
  const child = parentChildren[pi];
  const childPath = nodePath(rootPath, child, parentChildren, pi);
  if (child.name !== "Additive Pool" && child.name !== "Post-Processing")
    continue;
  const buckets = child.children || [];
  for (let bi = 0; bi < buckets.length; bi++) {
    const bucket = buckets[bi];
    const sys = parseSystemFromBucketName(bucket.name);
    if (!sys) continue;
    const bp = nodePath(childPath, bucket, buckets, bi);
    probes.push({
      pool: child.name === "Additive Pool" ? "Additive" : "Multi",
      bucketName: bucket.name,
      bucketPath: bp,
      bucketVal: Number(bucket.val) || 0,
    });
  }
}

let missing = 0;
let mismatched = 0;
for (const p of probes) {
  const flatVal = flat[p.bucketPath];
  if (flatVal === undefined) {
    console.log(`MISSING: ${p.pool.padEnd(9)} ${p.bucketPath}`);
    missing++;
  } else if (Math.abs(flatVal - p.bucketVal) > 1e-6) {
    console.log(
      `MISMATCH: ${p.pool} ${p.bucketPath}  flat=${flatVal}  bucket=${p.bucketVal}`
    );
    mismatched++;
  }
}

console.log(
  `\n${probes.length} bucket paths checked → ${missing} missing, ${mismatched} mismatched`
);
console.log(`Total DR: ${r.total.toFixed(3)}x`);
