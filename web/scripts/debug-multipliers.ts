// Diagnóstico: Glimbo + EtcBonuses(91) + outros multipliers questionáveis
import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { grid, chip } from "../lib/corgan/stats/systems/w4/lab";
import { etcBonus } from "../lib/corgan/stats/systems/common/etcBonus";
import * as data from "../lib/corgan/save/data";

const g = globalThis as any;
if (!g.window) g.window = g;

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
loadSaveData(raw);

import { gfoodBonusMULTI, goldFoodBonuses } from "../lib/corgan/stats/systems/common/goldenFood";
import { equipOrderData, equipQtyData } from "../lib/corgan/save/data";
console.log("=== GFOOD MULTI ===");
const gfm = gfoodBonusMULTI(2, null, saveData);
console.log("gfoodBonusMULTI(zArkhe) =", gfm);
// Detailed breakdown - call internal helpers directly
import { sigilBonus } from "../lib/corgan/stats/systems/w2/alchemy";
import { legendPTSbonus } from "../lib/corgan/stats/systems/w7/spelunking";
import { computeSeraphMulti } from "../lib/corgan/stats/systems/common/starSign";
import { vaultUpgBonus } from "../lib/corgan/stats/systems/common/vault";
import { votingBonusz } from "../lib/corgan/stats/systems/w2/voting";
import { pristineBon } from "../lib/corgan/stats/systems/w5/pristine";
import { getBribeBonus } from "../lib/corgan/stats/systems/w3/bribe";
import { getSetBonus } from "../lib/corgan/stats/systems/w3/setBonus";
import { computeCardLv } from "../lib/corgan/stats/systems/common/cards";
import { companions } from "../lib/corgan/stats/systems/common/companions";
import { etcBonus as etcBon } from "../lib/corgan/stats/systems/common/etcBonus";
import { starSignDropVal } from "../lib/corgan/stats/data/common/starSign";

const c8 = etcBon.resolve(8, { saveData, charIdx: 2 } as any);
console.log("\n--- GFOOD MULTI COMPONENT BREAKDOWN ---");
console.log("etcBonus(8):", c8.val);
console.log("sigil 14:", sigilBonus(14, saveData));
console.log("starS 69 ×seraph:", starSignDropVal(69) * computeSeraphMulti(2, saveData));
console.log("bribe 36:", getBribeBonus(36, saveData)?.val);
console.log("pristine 14:", pristineBon(14, saveData));
console.log("voting 26:", votingBonusz(26, undefined, saveData));
console.log("comp 48:", companions(48, saveData));
console.log("comp 155:", companions(155, saveData));
console.log("legend 25:", legendPTSbonus(25, saveData));
console.log("vault 86:", vaultUpgBonus(86, saveData));
console.log("setBonus SECRET_SET:", getSetBonus("SECRET_SET")?.val);
console.log("cropfall card lv:", computeCardLv("cropfallEvent1", saveData));
console.log("anni5 card lv:", computeCardLv("anni5Event1", saveData));

// Inspect individual components by computing them with the same helpers
import { computeAllTalentLVz } from "../lib/corgan/stats/systems/common/talent";
import { talentParams, FAMILY_BONUS_33, CLASS_TREES, TALENT_144 } from "../lib/corgan/stats/data/common/talent";
import { formulaEval } from "../lib/corgan/formulas";
import { skillLvData, charClassData, numCharacters, cauldronInfoData, stampLvData, klaData } from "../lib/corgan/save/data";
import { bubbleParams } from "../lib/corgan/stats/data/w2/alchemy";
import { isBubblePrismad, getPrismaBonusMult } from "../lib/corgan/stats/systems/w2/alchemy";
import { isFightingMap, mapKillReq } from "../lib/corgan/stats/data/common/maps";
import { cookingMealMulti } from "../lib/corgan/stats/systems/common/cooking";

// talent99
const sl99 = (skillLvData as any)[2] || {};
const rawLv99 = Number(sl99[99]) || 0;
let talent99 = 0;
if (rawLv99 > 0) {
  const allTalentLv = computeAllTalentLVz(99, 2, undefined, saveData);
  const eff = rawLv99 + allTalentLv;
  const t99 = talentParams(99);
  if (t99) talent99 = formulaEval(t99.formula, t99.x1, t99.x2, eff);
}
console.log("talent99 (HUNGRY):", talent99, "rawLv=" + rawLv99);

// stampG
const stampG = Number(((stampLvData as any)[2] || [])[6]) || 0;
console.log("stamp[2][6]:", stampG);

// alch bubble [0][18]
const shim = bubbleParams(0, 18);
let alchG = 0;
if (shim) {
  const bubbleLv = Number(((cauldronInfoData as any)[0] || [])[shim.index]) || 0;
  if (bubbleLv > 0) {
    const baseVal = formulaEval(shim.formula, shim.x1, shim.x2, bubbleLv);
    const isPrisma = isBubblePrismad(shim.cauldron, shim.index);
    const prismaMult = isPrisma ? Math.max(1, getPrismaBonusMult(saveData)) : 1;
    alchG = baseVal * prismaMult;
    console.log("bubble[0][18] lv:", bubbleLv, "base:", baseVal, "prisma:", prismaMult);
  }
}
console.log("alchG (bubble Y18):", alchG);

// meal[0][64]
const mealLv = Number(((saveData.mealsData as any) || [])[0]?.[64]) || 0;
if (mealLv > 0) {
  const cm = cookingMealMulti(saveData);
  console.log("meal[0][64] lv:", mealLv, "cookMulti:", cm.val, "→ mealG:", cm.val * mealLv * 2);
} else {
  console.log("meal[0][64] lv:", mealLv, "(zero)");
}

// FAMILY_BONUS_33
let dkIdx = -1;
let shamanIdx = -1;
for (let ci = 0; ci < numCharacters; ci++) {
  const classId = (charClassData as any)[ci] || 0;
  const tree = (CLASS_TREES as any)[classId];
  if (tree && tree.includes(33)) {
    const charLv = Number(((saveData.lv0AllData as any)?.[ci] || [])[0]) || 0;
    if (FAMILY_BONUS_33) {
      const effLv = Math.max(0, charLv - FAMILY_BONUS_33.lvOffset);
      const b = formulaEval(FAMILY_BONUS_33.formula, FAMILY_BONUS_33.x1, FAMILY_BONUS_33.x2, effLv);
      console.log(`  char ${ci} (cls ${classId}) lv=${charLv} → bonus ${b.toFixed(2)}`);
    }
  }
  if (tree && tree[3] === 10) dkIdx = ci;
}
console.log("DK char index:", dkIdx);
if (dkIdx >= 0) {
  const kla = (klaData as any)[dkIdx] || [];
  let count = 0;
  for (let m = 0; m < kla.length; m++) {
    if (!isFightingMap(m)) continue;
    const arr = kla[m];
    if (!Array.isArray(arr)) continue;
    const killsDone = mapKillReq(m) - Number(arr[0]);
    if (killsDone >= 1e9) count++;
  }
  console.log("apocalypses count:", count);
  const slDK = (skillLvData as any)[dkIdx] || {};
  const rawLv209 = Number(slDK[209]) || 0;
  console.log("DK talent 209 lv:", rawLv209);
}
console.log("\n=== EQUIPPED FOOD (zArkhe) ===");
const foodBag = (equipOrderData as any)[2]?.[2] || {};
const qtyBag = (equipQtyData as any)[2]?.[2] || {};
for (const i in foodBag) console.log(`  [${i}] = ${foodBag[i]} qty=${qtyBag[i]}`);
const bon = goldFoodBonuses("DropRatez", 2, gfm, saveData);
console.log("\n=== GOLD FOOD BONUSES ===");
console.log("total:", bon.total);
console.log("equipped:", bon.equipped);
console.log("emporium:", bon.emporium);

console.log("=== GRID/RESEARCH STATE ===");
console.log("gridLevels[168] =", (saveData.gridLevels as any[])[168]);
console.log("gridLevels[173] =", (saveData.gridLevels as any[])[173]);
console.log("shapeOverlay[168] =", (saveData.shapeOverlay as any[])[168]);
const trades = ((saveData.research as any)?.[12] as any[]) || [];
console.log("research[12] (trades) length =", trades.length);
let totalTrades = 0;
for (const t of trades) totalTrades += Number(t) || 0;
console.log("totalTrades =", totalTrades, "→ tradeGroups =", Math.floor(totalTrades / 100));

const ctx = { saveData, charIdx: 2 };
const glimboNode = grid.resolve(168, ctx);
console.log("\n=== GLIMBO NODE ===");
console.log("val =", glimboNode.val);
if (glimboNode.children) {
  for (const c of glimboNode.children) {
    console.log(`  ${c.name}: ${c.val} (fmt=${c.fmt})${c.note ? "  ("+c.note+")" : ""}`);
  }
}

console.log("\n=== ETC BONUS (91) — equipmentDrMulti ===");
const etc91 = etcBonus.resolve(91, ctx);
console.log("val =", etc91.val);
if (etc91.children) {
  for (const c of etc91.children) {
    console.log(`  ${c.name}: ${c.val}${c.note ? "  ("+c.note+")" : ""}`);
  }
}

import { GALLERY_STAT_FOR_ID, NAMETAG_DR } from "../lib/corgan/stats/data/w7/gallery";
console.log("\n[debug] GALLERY_STAT_FOR_ID[91] =", GALLERY_STAT_FOR_ID["91"]);
console.log("[debug] GALLERY_STAT_FOR_ID[2] =", GALLERY_STAT_FOR_ID["2"]);
console.log("[debug] spelunkData[17] length:", (saveData.spelunkData[17] || []).length);
console.log("[debug] non-zero spelunk[17]:", (saveData.spelunkData[17] || []).map((v: any, i: number) => v > 0 ? `[${i}]=${v}` : null).filter(Boolean).join(" "));
console.log("[debug] NAMETAG_DR sample (keys 0-5):", [0,1,2,3,4,5].map(k => `${k}: ${JSON.stringify(NAMETAG_DR[k])}`).join("  "));

// Search NAMETAG_DR for any entry with stat = %_DROP_RATE_MULTI
console.log("\n[debug] Nametags with %_DROP_RATE_MULTI stat:");
for (const k in NAMETAG_DR) {
  const entries = NAMETAG_DR[Number(k)];
  for (const e of entries) {
    if (e.stat === "%_DROP_RATE_MULTI") {
      console.log(`  id=${k} val=${e.val}`);
    }
  }
}

import { nametag as ng, galleryBonusMulti } from "../lib/corgan/stats/systems/w7/gallery";
import { NAMETAG_NAMES } from "../lib/corgan/stats/data/w7/gallery";
const nt91 = ng.resolve(91, ctx);
console.log("\n[debug] nametag.resolve(91) children:");
for (const c of nt91.children || []) {
  console.log(`  ${(c.val||0).toFixed(2).padStart(10)}  ${c.name}`);
}
console.log("\n[debug] manual loop for stat 91:");
const gbm = galleryBonusMulti(saveData).val;
console.log("gbm =", gbm);
const levels = saveData.spelunkData[17] || [];
for (let i = 0; i < levels.length; i++) {
  const lv = Number(levels[i]) || 0;
  if (lv < 1) continue;
  const drEntries = NAMETAG_DR[i];
  if (!drEntries) continue;
  for (const e of drEntries) {
    if (e.stat === "%_DROP_RATE_MULTI") {
      const tierIdx = Math.min(4, lv - 1);
      const tiers = [1,1.6,2,2.3,2.5];
      const v = tiers[tierIdx] * gbm * e.val;
      console.log(`  i=${i} lv=${lv} tier=${tiers[tierIdx]} val=${e.val} → ${v.toFixed(2)}  name=${NAMETAG_NAMES[i]}`);
    }
  }
}

console.log("\n=== ETC BONUS (99) — dropChanceEquip2 ===");
const etc99 = etcBonus.resolve(99, ctx);
console.log("val =", etc99.val);
if (etc99.children) {
  for (const c of etc99.children) {
    console.log(`  ${c.name}: ${c.val}${c.note ? "  ("+c.note+")" : ""}`);
  }
}
