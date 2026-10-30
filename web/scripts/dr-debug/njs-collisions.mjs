// Sub-case names ("X"==d) defined in more than one _customBlock dispatcher of the live N.js. The
// formulas.json snapshot keeps ONE body per name, so changes to the others never show in a diff.
// usage (from web/): node scripts/dr-debug/njs-collisions.mjs [nameFilterRegex]
import { readFileSync } from "node:fs";

const filter = new RegExp(process.argv[2] || ".");
const src = readFileSync("scripts/updater/.cache/N.new.js", "utf8");
const starts = [...src.matchAll(/_customBlock_(\w+)=function\(d,b,e\)\{/g)].map((m) => ({ name: m[1], at: m.index }));
const defs = {};
for (let i = 0; i < starts.length; i++) {
  const body = src.slice(starts[i].at, i + 1 < starts.length ? starts[i + 1].at : starts[i].at + 2e6);
  for (const m of body.matchAll(/"([A-Za-z0-9_]+)"==d/g)) (defs[m[1]] ??= new Set()).add(starts[i].name);
}
const coll = Object.entries(defs).filter(([n, s]) => s.size > 1 && filter.test(n)).sort();
for (const [n, s] of coll) console.log(n.padEnd(30), [...s].join(", "));
console.log(`${coll.length} colliding sub-case name(s)`);
