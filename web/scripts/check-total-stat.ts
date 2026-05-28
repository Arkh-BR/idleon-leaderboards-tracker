// Validation: computeTotalStat vs PVStatList_N (= [STR, AGI, WIS, LUK, level]).
//
// Loads the zArkhe save, runs computeTotalStat for STR/AGI/WIS/LUK on every
// character, and compares the result to the game-reported PVStatList values
// (stashed by the loader into saveData.statList). Small rounding diffs are
// expected (formula precision); large diffs indicate a porting bug.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { numCharacters } from "../lib/corgan/save/data";
import { computeTotalStat } from "../lib/corgan/stats/systems/common/stats";

const g = globalThis as any;
if (!g.window) g.window = g;

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
loadSaveData(raw);

const STATS = ["STR", "AGI", "WIS", "LUK"] as const;
// PVStatList layout: [STR, AGI, WIS, LUK, level]
const STAT_PV_IDX: Record<string, number> = { STR: 0, AGI: 1, WIS: 2, LUK: 3 };

const statList = (saveData as any).statList as number[][];
const charNames = (saveData as any).charNames as string[];

let totalChecks = 0;
let exactMatches = 0;
let closeMatches = 0; // within tolerance
let mismatches = 0;
const TOL_ABS = 2; // absolute rounding tolerance
const TOL_PCT = 0.005; // 0.5% relative tolerance

console.log("=== computeTotalStat vs PVStatList_N ===\n");

for (let ci = 0; ci < numCharacters; ci++) {
  const pv = statList && statList[ci];
  if (!pv || pv.length < 4) {
    console.log(`Char ${ci} (${charNames?.[ci] ?? "?"}): no PVStatList — skipping`);
    continue;
  }
  const name = charNames?.[ci] ?? `Char ${ci}`;
  const ctx = { saveData, charIdx: ci, activeCharIdx: ci };
  const cells: string[] = [];
  for (const stat of STATS) {
    const expected = Number(pv[STAT_PV_IDX[stat]]) || 0;
    let computed = 0;
    try {
      computed = computeTotalStat(stat, ci, ctx).computed;
    } catch (e) {
      computed = NaN;
      console.error(`  ! error computing ${stat} for char ${ci}:`, (e as Error).message);
    }
    totalChecks++;
    const diff = computed - expected;
    const absDiff = Math.abs(diff);
    const relDiff = expected !== 0 ? absDiff / expected : absDiff > 0 ? 1 : 0;
    let tag: string;
    if (diff === 0) {
      exactMatches++;
      tag = "OK";
    } else if (absDiff <= TOL_ABS || relDiff <= TOL_PCT) {
      closeMatches++;
      tag = "~ ";
    } else {
      mismatches++;
      tag = "XX";
    }
    cells.push(
      `${tag} ${stat}: got=${computed} exp=${expected} diff=${diff > 0 ? "+" : ""}${diff}`
    );
  }
  console.log(`Char ${ci} (${name}):`);
  for (const c of cells) console.log("    " + c);
}

console.log("\n=== SUMMARY ===");
console.log(`Total checks:  ${totalChecks}`);
console.log(`Exact match:   ${exactMatches}`);
console.log(`Close (<=${TOL_ABS} / <=${(TOL_PCT * 100).toFixed(1)}%): ${closeMatches}`);
console.log(`Mismatch:      ${mismatches}`);
const passRate = totalChecks > 0 ? ((exactMatches + closeMatches) / totalChecks) * 100 : 0;
console.log(`Pass rate (exact+close): ${passRate.toFixed(1)}%`);
