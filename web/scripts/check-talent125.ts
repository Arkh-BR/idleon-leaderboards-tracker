import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { currentMapData, numCharacters, charClassData } from "../lib/corgan/save/data";
import { MapAFKtarget } from "../lib/corgan/stats/data/game/customlists.js";
import { MONSTERS } from "../lib/corgan/stats/data/game/monsters.js";
import { computeAccuracy } from "../lib/corgan/stats/systems/common/derived-damage";
import { computeCalcTalent } from "../lib/corgan/stats/systems/common/calcTalent";
import { talent } from "../lib/corgan/stats/systems/common/talent";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

// Refinery-rank sum is account-wide (Σ Refinery[3+g][1], g=0..5).
let refSum = 0;
const refinery = (saveData as any).refineryData;
if (refinery) for (let gI = 0; gI < 6; gI++) refSum += Number(refinery[3 + gI] && refinery[3 + gI][1]) || 0;
console.log(`Refinery rank sum (Σ Refinery[3..8][1]) = ${refSum}`);
console.log(`numCharacters = ${numCharacters}`);
console.log("");

console.log(
  "Ch | Cls | Map | AFKtarget        | Defence | 2.25×Def     | Accuracy       | Gate | CalcMAP[125] | t.resolve(125)"
);
console.log(
  "---|-----|-----|------------------|---------|--------------|----------------|------|--------------|---------------"
);

for (let ci = 0; ci < numCharacters; ci++) {
  const cls = Number((charClassData as any)[ci]) || 0;
  const mapIdx = Number((currentMapData as any)?.[ci]) || 0;
  const monsterKey = (MapAFKtarget as any)[mapIdx];
  const mon = monsterKey && (MONSTERS as any)[monsterKey];
  const defence = Number(mon && mon.Defence) || 0;

  let acc = NaN;
  let threw = "";
  try {
    acc = computeAccuracy(ci, { saveData, charIdx: ci });
  } catch (e) {
    threw = "THROW:" + (e as Error).message;
  }

  const gate = acc >= 2.25 * defence;
  const calcMap = computeCalcTalent(125, ci, saveData);

  let resolved = NaN;
  let tv = NaN;
  try {
    const node = talent.resolve(125, { saveData, charIdx: ci, activeCharIdx: ci });
    resolved = Number(node.val);
    // per-level talent value GTN(1,125) — strip the counter back out for clarity
    tv = calcMap > 0 ? resolved / calcMap : 0;
  } catch (e) {
    threw += " RESOLVE_THROW:" + (e as Error).message;
  }
  void tv;

  const finite = Number.isFinite(acc) ? "" : " [NON-FINITE]";
  console.log(
    `${String(ci).padStart(2)} | ${String(cls).padStart(3)} | ${String(mapIdx).padStart(3)} | ${String(
      monsterKey || "-"
    ).padEnd(16)} | ${String(defence).padStart(7)} | ${(2.25 * defence)
      .toFixed(1)
      .padStart(12)} | ${acc.toExponential(4).padStart(14)} | ${(gate ? "PASS" : "fail").padStart(
      4
    )} | ${String(calcMap).padStart(12)} | ${resolved.toFixed(3).padStart(13)} ${threw}${finite}`
  );
}

console.log("");
console.log("Notes:");
console.log("- Gate multiplier 2.25 (confirmed N.js case 125, offset 4421512).");
console.log("- Refinery sum shape: Σ Refinery[3+g][1] for g=0..5 (account-wide).");
console.log("- AFK target monster = MONSTERS[MapAFKtarget[CurrentMap[ci]]]; defence = .Defence.");
