// Every DR tree leaf that differs between two saves (README.md §5): the /drop-rate page's tree (lib/game, computeGameDropRateV1), keyed by
// the page's own paths (flattenTree, the snapshot/Compare keys).
// usage: npx tsx --tsconfig tsconfig.json scripts/dr-debug/tree-diff.ts <saveA> <saveB> <charA> <mapA> [charB] [mapB]
import { readFileSync } from "node:fs";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { computeGameDropRateV1 } from "@/lib/game/trackers/dropRateV1";

const [pa, pb, ca, ma, cb = ca, mb = ma] = process.argv.slice(2);
const load = (p: string) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const flat = (save: unknown, ci: number, map: number) => {
  const r = computeGameDropRateV1(save, ci, map);
  return { total: r.total, out: flattenTree(r.tree) };
};
const A = flat(load(pa), Number(ca), Number(ma));
const B = flat(load(pb), Number(cb), Number(mb));
console.log(`A ${A.total}  B ${B.total}`);
for (const k of new Set([...Object.keys(A.out), ...Object.keys(B.out)])) {
  const x = A.out[k], y = B.out[k];
  if (x === y || (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x)))) continue;
  if (/Available DR Items|Not equipped|Reference Character|Max Book Lv Cap/.test(k)) continue; // the explainers' listing rows, not values
  console.log(`${k.slice(0, 160)}: ${x} → ${y}`);
}
