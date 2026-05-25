// Smoke test for Stage 4: exercise the chain systems against ARKHE.
// Confirms shape/wiring, not exact numeric parity (some Stage 4 systems
// have shortcut stubs in deeper deps that Stage 5 will replace).

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { alchemy, sigil } from "../lib/corgan/stats/systems/w2/alchemy";
import { grid, chip, mainframeBonus, charHasChip } from "../lib/corgan/stats/systems/w4/lab";
import { tome } from "../lib/corgan/stats/systems/w4/tome";
import { grimoire } from "../lib/corgan/stats/systems/mc/grimoire";
import { arcaneMap, arcaneUpgBonus } from "../lib/corgan/stats/systems/mc/tesseract";
import { minehead, mineheadBonusQTY } from "../lib/corgan/stats/systems/w7/minehead";
import { sushiRoG, rogBonusQTY } from "../lib/corgan/stats/systems/w7/sushi";
import { winBonus, computeWinBonus } from "../lib/corgan/stats/systems/w6/summoning";
import { glimbo, workshop, eventShop } from "../lib/corgan/stats/systems/common/wrappers";
import { cookingMealMulti } from "../lib/corgan/stats/systems/common/cooking";
import { starSign, computeSeraphMulti } from "../lib/corgan/stats/systems/common/starSign";
import { computeArtifactBonus } from "../lib/corgan/stats/systems/w5/sailing";
import { galleryBonusMulti } from "../lib/corgan/stats/systems/w7/gallery";
import { lukScaling, lukCurve } from "../lib/corgan/stats/systems/common/stats";

const SAVE_PATH =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
loadSaveData(raw);
console.log(`[corgan-stage4] Loaded — ${saveData.charNames.length} chars\n`);

const ctx = { saveData, charIdx: 0, activeCharIdx: 0, mapBon: saveData.mapBonData, mapIdx: 0 };

function show(label: string, n: any) {
  const v = typeof n.val === "number" ? n.val.toFixed(3) : String(n.val);
  const fmt = n.fmt ? ` [${n.fmt}]` : "";
  const c = n.children && n.children.length ? ` (${n.children.length}c)` : "";
  console.log(`  ${label.padEnd(36)} ${v}${fmt}${c}`);
}

function showNum(label: string, v: number) {
  console.log(`  ${label.padEnd(36)} ${v.toFixed(3)}`);
}

console.log("=== Chain systems (resolvers) ===");
show("alchemy DROPPIN_LOADS", alchemy.resolve("DROPPIN_LOADS", ctx));
show("sigil 11 (TROVE)", sigil.resolve(11, ctx));
show("grid 173 (DR research)", grid.resolve(173, ctx));
show("grid 168 (Glimbo DR multi)", grid.resolve(168, ctx));
show("chip 'dr' (Grounded Processor)", chip.resolve("dr", ctx));
show("grimoire 44 (DR)", grimoire.resolve(44, ctx));
show("arcaneMap (map 0)", arcaneMap.resolve(0, ctx));
show("minehead 0 (floor 1)", minehead.resolve(0, ctx));
show("sushiRoG 48 (RoG DR)", sushiRoG.resolve(48, ctx));
show("winBonus 9 (DR)", winBonus.resolve(9, ctx));
show("glimbo (wraps grid 168)", glimbo.resolve(0, ctx));
show("workshop (talent 328)", workshop.resolve(0, ctx));
show("eventShop 27", eventShop.resolve(27, ctx, [1]));
show("starSign 'drop'", starSign.resolve("drop", ctx));
show("tome 2", tome.resolve(2, ctx));
show("tome 7", tome.resolve(7, ctx));
show("lukScaling", lukScaling.resolve(0, ctx));

console.log("\n=== Helper functions ===");
showNum("arcaneUpgBonus(48)", arcaneUpgBonus(48, saveData));
showNum("mineheadBonusQTY(0, floor)", mineheadBonusQTY(0, Number(saveData.stateR7?.[4]) || 0));
showNum("rogBonusQTY(48, cachedUS)", rogBonusQTY(48, saveData.cachedUniqueSushi));
showNum("computeWinBonus(9)", computeWinBonus(9, null, saveData));
showNum("computeSeraphMulti(0)", computeSeraphMulti(0, saveData));
showNum("computeArtifactBonus(35)", computeArtifactBonus(35, 0, ctx));
showNum("galleryBonusMulti", galleryBonusMulti(saveData).val);
showNum("cookingMealMulti", cookingMealMulti(saveData).val);
showNum("mainframeBonus(7) (cert stamp)", mainframeBonus(7, saveData));
showNum("charHasChip(0,'card1')", charHasChip(0, "card1") ? 1 : 0);

console.log("\n=== Luk curve ===");
const arkheLuck = saveData.lv0AllData?.[0]?.[7] || 0;
console.log(`  ARKHE raw LUK (lv0AllData[0][7]) = ${arkheLuck}`);
console.log(`  lukCurve(${arkheLuck}) = ${lukCurve(arkheLuck).toFixed(4)}`);
console.log(`  IT-port luckMulti (1.4 × curve) = ${(1.4 * lukCurve(arkheLuck)).toFixed(4)}`);

console.log("\n[corgan-stage4] All Stage 4 systems resolved. Stage 4 OK.");
