// Smoke test for Stage 1 of the Corgan port: feed an IT envelope to
// loadSaveData() and assert that the state singleton is reasonably populated.
// Doesn't compute drop rate yet — that's Stage 5.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import * as data from "../lib/corgan/save/data";

const SAVE_PATH =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

console.log(`[corgan-loader] Loading ${SAVE_PATH}`);
const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));

const t0 = Date.now();
loadSaveData(raw);
const ms = Date.now() - t0;

console.log(`[corgan-loader] loadSaveData ran in ${ms}ms\n`);

// Spot-check fields critical for drop-rate systems.
const checks: Array<[string, unknown, (v: any) => boolean]> = [
  ["saveData.charNames length", saveData.charNames, (v) => Array.isArray(v) && v.length > 0],
  ["saveData.olaData length", saveData.olaData, (v) => Array.isArray(v) && v.length > 100],
  ["saveData.cards0Data keys", Object.keys(saveData.cards0Data || {}), (v) => v.length > 0],
  ["saveData.cards1Data length", saveData.cards1Data, (v) => Array.isArray(v) && v.length > 0],
  ["saveData.grimoireData length", saveData.grimoireData, (v) => Array.isArray(v) && v.length > 0],
  ["saveData.vaultData length", saveData.vaultData, (v) => Array.isArray(v) && v.length > 0],
  ["saveData.holesData length", saveData.holesData, (v) => Array.isArray(v) && v.length > 0],
  ["saveData.shrineData length", saveData.shrineData, (v) => Array.isArray(v) && v.length > 0],
  ["saveData.companionIds size", saveData.companionIds, (v) => v instanceof Set && v.size > 0],
  ["saveData.lv0AllData length", saveData.lv0AllData, (v) => Array.isArray(v) && v.length > 0],
  ["data.skillLvData length", data.skillLvData, (v) => Array.isArray(v) && v.length > 0],
  ["data.charClassData length", data.charClassData, (v) => Array.isArray(v) && v.length > 0],
  ["data.cauldronInfoData length", data.cauldronInfoData, (v) => Array.isArray(v) && v.length > 0],
  ["data.stampLvData keys", Object.keys(data.stampLvData || {}), (v) => v.length > 0],
  ["data.optionsListData length", data.optionsListData, (v) => Array.isArray(v) && v.length > 100],
  ["data.cardEquipData length", data.cardEquipData, (v) => Array.isArray(v) && v.length > 0],
  ["data.mapBonData length", data.mapBonData, (v) => Array.isArray(v) && v.length > 0],
];

let pass = 0;
let fail = 0;
for (const [label, val, predicate] of checks) {
  const ok = (() => {
    try {
      return predicate(val);
    } catch {
      return false;
    }
  })();
  const size =
    Array.isArray(val)
      ? val.length
      : val instanceof Set
        ? val.size
        : typeof val === "object" && val !== null
          ? Object.keys(val as object).length
          : val;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(36)} → ${size}`);
  if (ok) pass++;
  else fail++;
}

console.log(
  `\n[corgan-loader] ${pass} passed, ${fail} failed (${
    fail === 0 ? "Stage 1 foundation OK" : "still some gaps"
  })`
);
if (fail > 0) process.exitCode = 1;
