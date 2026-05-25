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

import { gfoodBonusMULTI } from "../lib/corgan/stats/systems/common/goldenFood";
console.log("=== GFOOD MULTI ===");
const gfm = gfoodBonusMULTI(2, null, saveData);
console.log("gfoodBonusMULTI(zArkhe) =", gfm);

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
