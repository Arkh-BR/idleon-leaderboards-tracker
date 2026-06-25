// PROBE (one-shot, throwaway) — inspect the REAL DR flat-tree structure of the
// anchor save (zArkhe, Divine Knight) so the Biggest Gains math is fixed against
// ground truth instead of guesses. Also enumerates the direct children of the
// two pools (Additive Pool / Post-Processing) to seed the denylist, and writes a
// regression fixture for the pure-module unit tests.
//
//   npx tsx scripts/probe-biggest-gains.ts
//
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { computeArkhDropRate } from "../lib/arkh/computeDR";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { parseSave, listCharacters } from "../lib/dropRate/extract";
import { getCharClassKey } from "../lib/talentsLevel/charClass";
import { topDrFlatForClass } from "../lib/dropRate/topDropRate";

// Polyfill window for IT's getDropRate (uses window.gtag in error catch)
const g = globalThis as any;
if (!g.window) g.window = g;

// The anchor save (`save 0806.txt`) is NOT versioned and lives at the repo root.
// Run from web/ in the main checkout and it resolves one level up; override with
// `npx tsx scripts/probe-biggest-gains.ts <path>` or ANCHOR_SAVE when elsewhere
// (e.g. a worktree, whose root has no copy of the save).
const SAVE_PATH =
  process.argv[2] ||
  process.env.ANCHOR_SAVE ||
  resolve(process.cwd(), "..", "save 0806.txt");

const text = readFileSync(SAVE_PATH, "utf8");
const save = parseSave(text);
const raw = JSON.parse(text);
const chars = listCharacters(save);
console.log("Characters:", chars.map((c) => `${c.charIndex}:${c.charName}`).join(", "));

const ch = chars.find((c) => c.charName === "zArkhe");
if (!ch) throw new Error("zArkhe not found in save");
const charIdx = ch.charIndex;
const classKey = getCharClassKey(save as any, charIdx);
console.log(`\nzArkhe charIdx=${charIdx} classKey=${classKey}`);

const { tree, total } = computeArkhDropRate(raw, charIdx, 0);
const yours = flattenTree(tree);
const ref = topDrFlatForClass(classKey) as Record<string, number>;

console.log(`Total DR = ${total.toFixed(2)}x`);
console.log(`Drop Rate (flat)            = ${yours["Drop Rate"]}`);
console.log(`Drop Rate / Additive Pool   = ${yours["Drop Rate / Additive Pool"]}`);
console.log(`Drop Rate / Post-Processing = ${yours["Drop Rate / Post-Processing"]}`);
console.log(`[ref] Drop Rate / Additive Pool   = ${ref["Drop Rate / Additive Pool"]}`);
console.log(`[ref] Drop Rate / Post-Processing = ${ref["Drop Rate / Post-Processing"]}`);

function directChildren(flat: Record<string, number>, poolPath: string): string[] {
  const prefix = poolPath + " / ";
  const out: string[] = [];
  for (const p of Object.keys(flat)) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (rest.includes(" / ")) continue; // direct child only
    out.push(p);
  }
  return out;
}

const ADD = "Drop Rate / Additive Pool";
const POST = "Drop Rate / Post-Processing";

// TotalSum = 1 + AdditivePool_pp/100. We need to learn what the pool node value
// means. Print both pool node values and the sum of direct additive children.
const addChildren = directChildren(yours, ADD);
const postChildren = directChildren(yours, POST);
const sumAddYours = addChildren.reduce((s, p) => s + (yours[p] || 0), 0);
console.log(`\nsum(direct additive children, yours) = ${sumAddYours}`);
console.log(`# additive children=${addChildren.length}  # post children=${postChildren.length}`);

console.log("\n===== ADDITIVE POOL — direct children =====");
console.log("path | yours | ref");
for (const p of addChildren.sort()) {
  console.log(`${p.replace(ADD + " / ", "")} | ${yours[p]} | ${ref[p] ?? "—"}`);
}

console.log("\n===== POST-PROCESSING — direct children =====");
console.log("path | yours | ref");
for (const p of postChildren.sort()) {
  console.log(`${p.replace(POST + " / ", "")} | ${yours[p]} | ${ref[p] ?? "—"}`);
}

// --- Candidate gain math (to validate top-3 = Gallery+37 / Cards+23 / GFood+10)
// TotalSum = 1 + AdditivePool_pp/100 (verified: 411.67 × 133.79 ≈ 55080).
// This is the additive-lever denominator the production module uses; using the
// raw pool node here would shrink every additive gain 100× and mis-rank them.
const totalSum = 1 + (yours[ADD] || 0) / 100;
console.log(`\nTotalSum (= 1 + AdditivePool/100) = ${totalSum}`);

type Row = { system: string; type: "additive" | "multiplier"; you: number; max: number; gain: number };
const rows: Row[] = [];
for (const p of addChildren) {
  const you = yours[p] || 0;
  const max = ref[p];
  if (typeof max !== "number") continue;
  // additive: DR_gain% = ((max - you)/100) / TotalSum * 100  -- but units of pp unknown
  const gain = ((max - you) / 100) / totalSum * 100;
  rows.push({ system: p.replace(ADD + " / ", ""), type: "additive", you, max, gain });
}
for (const p of postChildren) {
  const you = yours[p] || 0;
  const max = ref[p];
  if (typeof max !== "number") continue;
  const gain = (max / you - 1) * 100;
  rows.push({ system: p.replace(POST + " / ", ""), type: "multiplier", you, max, gain });
}
rows.sort((a, b) => b.gain - a.gain);
console.log("\n===== CANDIDATE RANKING (top 12) =====");
for (const r of rows.slice(0, 12)) {
  console.log(`${r.gain >= 0 ? "+" : ""}${r.gain.toFixed(2)}% | ${r.type} | ${r.system} | you=${r.you} max=${r.max}`);
}

// --- Write fixture for unit tests (anchor regression) ---
const fixtureDir = resolve(process.cwd(), "__tests__", "fixtures");
mkdirSync(fixtureDir, { recursive: true });
const fixture = {
  meta: {
    source: "save 0806.txt",
    char: "zArkhe",
    charIdx,
    classKey,
    totalDr: total,
    generatedNote: "probe-biggest-gains.ts — regression anchor for biggestGains",
  },
  yours,
  ref,
};
writeFileSync(resolve(fixtureDir, "zarkhe-biggest-gains.json"), JSON.stringify(fixture, null, 0), "utf8");
console.log("\nWrote fixture: __tests__/fixtures/zarkhe-biggest-gains.json");
