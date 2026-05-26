// ===== Research Grid + Well Dressed audit =====
// Reports the complete state of every Research grid that affects DR
// (172 Well Dressed, 173 Divine Design, 168 Glimbo Insider Trading
// Secrets), plus the gridAllMulti chain (companions + cloud bonuses +
// grid 173 feedback), plus the per-attire-slot breakdown showing
// rawVal × Well Dressed multiplier on slot 15.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";
import { gridBonusValue } from "../lib/corgan/stats/systems/w4/lab";
import {
  RES_GRID_RAW,
  SHAPE_BONUS_PCT,
  SHAPE_NAMES,
  gridBonusPerLv,
} from "../lib/corgan/stats/data/w7/research";
import { saveData } from "../lib/corgan/state";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
// computeCorganDropRate runs the loader internally as a side-effect,
// populating saveData. Run it first so the registry queries below have
// real data to read.
const r = computeCorganDropRate(raw, 2, 0);

// =========== Grid catalog ===========
console.log("=== Research grid registry (all DR-relevant grids) ===");
const DR_GRIDS = [168, 172, 173];
for (const id of DR_GRIDS) {
  const meta = RES_GRID_RAW[id];
  const gridLv = Number((saveData.gridLevels as any)?.[id]) || 0;
  const si = Number((saveData.shapeOverlay as any)?.[id]);
  const shapePct = si >= 0 && si < SHAPE_BONUS_PCT.length ? SHAPE_BONUS_PCT[si] : 0;
  const shapeName = si >= 0 && si < SHAPE_NAMES.length ? SHAPE_NAMES[si] : "none";
  const bonus = gridBonusValue(id, saveData);
  console.log(`Grid ${id}: ${meta?.[0] || "(unknown)"}`);
  console.log(`  per-level: ${meta?.[2]} (lookup: ${gridBonusPerLv(id)})`);
  console.log(`  level: ${gridLv}/${meta?.[1]}`);
  console.log(`  shape: ${shapeName} (+${shapePct}%, idx=${si})`);
  console.log(`  computed bonus value: ${bonus.toFixed(3)}`);
}

// =========== Glimbo & Divine Design contributions to DR ===========
console.log("\n=== Where DR-relevant grids feed the formula ===");
type N = { name: string; val: number; fmt?: string; children?: N[] };
function findAll(n: N, pred: (n: N) => boolean, out: N[] = []): N[] {
  if (pred(n)) out.push(n);
  for (const c of n.children || []) findAll(c, pred, out);
  return out;
}
const divine = findAll(r.tree as N, (n) =>
  /Divine Design|Grid 173/i.test(n.name)
);
const glimbo = findAll(r.tree as N, (n) =>
  /Glimbo|Grid 168/i.test(n.name)
);
const wellDressed = findAll(r.tree as N, (n) =>
  /Well Dressed|Grid 172/i.test(n.name)
);
console.log(`Divine Design hits: ${divine.length}`);
for (const n of divine)
  console.log(`  • ${n.name} → ${n.val.toFixed(3)}${n.fmt === "x" ? "x" : ""}`);
console.log(`Glimbo hits: ${glimbo.length}`);
for (const n of glimbo)
  console.log(`  • ${n.name} → ${n.val.toFixed(3)}${n.fmt === "x" ? "x" : ""}`);
console.log(`Well Dressed hits in tree: ${wellDressed.length}`);
for (const n of wellDressed)
  console.log(`  • ${n.name} → ${n.val.toFixed(3)}${n.fmt === "x" ? "x" : ""}`);

// =========== Equipment slot 15 (Attire) breakdown ===========
console.log("\n=== Attire slot 15 — Well Dressed multiplier check ===");
const eq = findAll(r.tree as N, (n) => /Equipment \(etcBonus/.test(n.name));
console.log(`Equipment buckets found: ${eq.length}`);
function dumpDeep(n: N, depth: number, maxDepth: number) {
  if (depth > maxDepth) return;
  const pad = "   ".repeat(depth);
  const fmt = n.fmt === "x" ? "x" : "";
  console.log(`${pad}• ${n.name.padEnd(48 - depth * 3)} ${n.val.toFixed(3)}${fmt}`);
  for (const c of n.children || []) dumpDeep(c, depth + 1, maxDepth);
}
for (const e of eq) {
  console.log(`  ${e.name} (val=${e.val.toFixed(3)})`);
  for (const c of e.children || []) dumpDeep(c, 1, 4);
}

console.log("\nTotal DR:", r.total.toFixed(3));
