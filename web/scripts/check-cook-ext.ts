// Valida os 5 fatores externos da Exp/h contra o save real (produto alvo ≈ 15.914).
// Uso: npx tsx scripts/check-cook-ext.ts ["save.txt"]
import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/arkh/save/loader";
import { saveData } from "../lib/arkh/state";
import { gridBonusValue } from "../lib/arkh/stats/systems/w4/lab";
import { arcadeBonus } from "../lib/arkh/stats/systems/w2/arcade";
import { computeVialByKey } from "../lib/arkh/stats/systems/w2/alchemy";
import * as cl from "../lib/arkh/stats/data/game/customlists";

const g = globalThis as any;
if (!g.window) g.window = g;

const path =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 0806.txt";
loadSaveData(JSON.parse(readFileSync(path, "utf8")));

console.log("SaltLicks[10]      :", JSON.stringify((cl as any).SaltLicks?.[10]));
console.log("ResGridSquares[190]:", JSON.stringify((cl as any).ResGridSquares?.[190]));
console.log(
  "Number2Letter      :",
  "exists?", !!(cl as any).Number2Letter,
  "len", (cl as any).Number2Letter?.length,
  "=>", JSON.stringify((cl as any).Number2Letter),
);
console.log(
  "grid 190           :",
  "gridLevels.len", (saveData.gridLevels as any)?.length,
  "gridLevels[190]", (saveData.gridLevels as any)?.[190],
  "research[0].len", (saveData.research as any)?.[0]?.length,
  "research[0][190]", (saveData.research as any)?.[0]?.[190],
);

// 1) Research Grid 190
const grid190 = gridBonusValue(190, saveData);
// 2) Zuperbit 68: SuperBitType(b) = Gaming[12].indexOf(Number2Letter[b]) != -1.
// Number2Letter is a runtime asset (not in the bundle); super bits unlock
// sequentially, so Gaming[12] is a prefix of Number2Letter ⇒ bit b is bought
// iff b < Gaming[12].length.
const gaming12 = String((saveData.gamingData as any[])?.[12] ?? "");
console.log("Gaming[12].length  :", gaming12.length);
const superBit68 = gaming12.length > 68 ? 1 : 0;
// 3) Companion 87
const comp87 = saveData.companionIds.has(87) ? 1 : 0;
// 4) Vial 7cookmastery
const vial7cm = computeVialByKey("7cookmastery", saveData).val;
// 5) Arcade 69
const arcade69 = arcadeBonus(69, saveData).val;
// 6) Salt Lick 10 = SaltLick[10] × SaltLicks[10][3]
const slLv = Number((saveData.saltLickData as any[])?.[10]) || 0;
const saltLick10 = slLv > 0 ? slLv * (Number(cl.SaltLicks?.[10]?.[3]) || 0) : 0;

console.log("\nComponentes:");
console.log({ grid190, gaming12Len: gaming12.length, superBit68, comp87, vial7cm, arcade69, slLv, saltLick10 });

const ext =
  (1 + grid190 / 100) *
  (1 + (40 * superBit68) / 100) *
  (1 + 2 * comp87) *
  (1 + (vial7cm + arcade69 + saltLick10) / 100);

console.log("\nexternalMulti computado:", ext.toFixed(4));
console.log("alvo (Exp/h in-game)   : 15.9140");
console.log("erro                   :", (((ext / 15.914) - 1) * 100).toFixed(2) + "%");
