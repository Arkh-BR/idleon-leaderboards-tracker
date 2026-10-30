// Every DR tree leaf that differs between two saves (README.md §5).
// usage: npx tsx --tsconfig tsconfig.json scripts/dr-debug/tree-diff.ts <saveA> <saveB> <charA> <mapA> [charB] [mapB]
import { readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";

const [pa, pb, ca, ma, cb = ca, mb = ma] = process.argv.slice(2);
const load = (p: string) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const flat = (save: any, ci: number, map: number) => {
  const r = computeArkhDropRate(save, ci, map);
  const out: Record<string, number> = {};
  const walk = (n: any, p: string) => { const k = p ? `${p} > ${n.name}` : n.name; out[k] = Number(n.val); for (const c of n.children || []) walk(c, k); };
  for (const c of r.tree.children) walk(c, "");
  return { total: r.total, out };
};
const A = flat(load(pa), Number(ca), Number(ma));
const B = flat(load(pb), Number(cb), Number(mb));
console.log(`A ${A.total}  B ${B.total}`);
for (const k of new Set([...Object.keys(A.out), ...Object.keys(B.out)])) {
  const x = A.out[k], y = B.out[k];
  if (x === y || (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x)))) continue;
  if (/Available DR Items|Not equipped|Reference Character|Max Book Lv Cap/.test(k)) continue;
  console.log(`${k.slice(0, 160)}: ${x} → ${y}`);
}
