// N.js formulas reachable from one TotalStats branch (default "Drop_Rarity") that REALLY changed vs an
// older snapshot (minifier renames ignored), or, with --calls <Fn>, which indices of Fn that path uses.
// usage (from web/): node scripts/dr-debug/njs-reach.mjs <git-ref-of-old-snapshot> [Branch] [--calls ArtifactBonus]
// e.g.  node scripts/dr-debug/njs-reach.mjs 0fd1063 Drop_Rarity
//       node scripts/dr-debug/njs-reach.mjs 0fd1063 Drop_Rarity --calls ExoticBonusQTY
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const callsAt = args.indexOf("--calls");
const callFn = callsAt >= 0 ? args[callsAt + 1] : null;
const [ref, branch = "Drop_Rarity"] = callsAt >= 0 ? args.slice(0, callsAt) : args;
const NEW = JSON.parse(readFileSync("data/njs-snapshot/formulas.json", "utf8"));
const OLD = ref ? JSON.parse(execSync(`git show ${ref}:web/data/njs-snapshot/formulas.json`, { maxBuffer: 1e9 }).toString()) : {};
const norm = (s) => (s || "").replace(/\b[a-zA-Z_$][\w$]?\b/g, "§"); // ≤2-char aliases rename every build
const changed = new Set(Object.keys(NEW).filter((k) => norm(NEW[k]) !== norm(OLD[k])));

const ts = NEW["_customBlock_TotalStats"];
const head = `"${branch}"==d?`;
const i = ts.indexOf(head);
if (i < 0) throw new Error(`branch ${branch} not found in TotalStats`);
let depth = 0, j = i + head.length;
for (; j < ts.length; j++) { const c = ts[j]; if ("([{".includes(c)) depth++; else if (")]}".includes(c)) depth--; else if (c === ":" && depth === 0) break; }
const refsOf = (txt) => {
  const out = new Set();
  for (const m of txt.matchAll(/_customBlock_(\w+)\("([A-Za-z0-9_]+)"/g)) { out.add(m[2]); out.add("_customBlock_" + m[1]); }
  for (const m of txt.matchAll(/_customBlock_(\w+)\(/g)) out.add("_customBlock_" + m[1]);
  return [...out].filter((k) => k in NEW);
};
const seen = new Set(), parent = {};
const queue = refsOf(ts.slice(i, j));
for (const q of queue) parent[q] = branch;
for (const k of ["_customBlock_EtcBonuses", "_customBlock_GoldFoodBonuses", "_customBlock_MealBonus"]) if (k in NEW) { queue.push(k); parent[k] = "seed"; }
while (queue.length) {
  const k = queue.shift();
  if (seen.has(k)) continue;
  seen.add(k);
  if (/^_customBlock_/.test(k) && NEW[k].length > 60000) continue; // don't expand whole dispatchers
  for (const r of refsOf(NEW[k])) if (!seen.has(r)) { if (!(r in parent)) parent[r] = k; queue.push(r); }
}
if (callFn) {
  for (const k of seen) {
    const ids = [...new Set([...(NEW[k] || "").matchAll(new RegExp(`"${callFn}",\\s*(\\d+),\\s*(\\d+)`, "g"))].map((m) => m[1] + (m[2] !== "0" ? "e" + m[2] : "")))];
    if (ids.length && NEW[k].length < 60000) console.log(k.padEnd(34), ids.join(","));
  }
} else {
  const hits = [...seen].filter((k) => changed.has(k)).sort();
  console.log(`reachable ${seen.size} · changed & reachable ${hits.length}`);
  for (const h of hits) {
    const path = []; let p = h;
    while (p && p !== branch && p !== "seed" && path.length < 8) { path.push(p); p = parent[p]; }
    console.log(`${h.padEnd(34)} via ${path.reverse().join(" → ")}`);
  }
}
