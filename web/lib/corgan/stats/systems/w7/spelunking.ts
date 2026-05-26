// ===== SPELUNKING SYSTEM (W7) =====
// Real port replacing Stage 2 stub. Covers legendPTSbonus,
// spelunkShop.resolve, computePaletteBonus, palette.resolve, BigFish,
// shopUpgBonus, chapterBonus.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { legendTalentPerPt } from "../../data/w7/legendTalent";
import { spelunkUpgPerLevel } from "../../data/w7/spelunking";
import { paletteParams } from "../../data/w4/gaming";
import {
  Spelunky,
  SpelunkUpg,
  SpelunkChapters,
} from "../../data/game/customlists.js";
import { superBitType } from "../../../game-helpers";
import { formulaEval } from "../../../formulas";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function legendPTSbonus(idx: number, saveData: SaveData): number {
  const lv = Number(
    (saveData.spelunkData &&
      saveData.spelunkData[18] &&
      (saveData.spelunkData[18] as any)[idx]) ||
      0
  );
  const perPt = legendTalentPerPt(idx);
  return Math.round(lv * perPt);
}

const SPELUNK_DATA: Record<number, unknown> = { 50: {} };
// Friendly names for the Spelunk Shop upgrades the DR pool references.
// Sourced from spelunkingUpgrades[i].name in IT website-data.
const SPELUNK_SHOP_NAMES: Record<number, string> = {
  50: "Golden Hardhat",
};

export const spelunkShop = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const data = SPELUNK_DATA[id];
    const friendly = SPELUNK_SHOP_NAMES[id];
    const name = friendly
      ? `${friendly} (Spelunking ${id})`
      : label("Spelunking", id);
    if (!data) return node(name, 0, null, { note: "spelunk " + id });
    const saveData = ctx.saveData;
    const shopLv = Number(
      (saveData.spelunkData &&
        saveData.spelunkData[5] &&
        (saveData.spelunkData[5] as any)[id]) ||
        0
    );
    if (shopLv <= 0) return node(name, 0, null, { note: "spelunk " + id });
    const perLevel = spelunkUpgPerLevel(id);
    const val = perLevel * shopLv;
    return node(
      name,
      val,
      [
        node("Shop Level", shopLv, null, { fmt: "raw" }),
        node("Per Level", perLevel, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "spelunk " + id }
    );
  },
};

// ===== PALETTE BONUS =====
const PALETTE_SUPERBIT_PAIRS: number[][] = [
  [49, 25], [51, 13], [52, 31], [54, 18], [58, 3], [61, 12],
];

export function computePaletteBonus(paletteIdx: number, saveData: SaveData): number {
  const paletteLv = Number(
    (saveData.spelunkData &&
      saveData.spelunkData[9] &&
      (saveData.spelunkData[9] as any)[paletteIdx]) ||
      0
  );
  if (paletteLv <= 0) return 0;
  const pal = paletteParams(paletteIdx) as any;
  if (!pal) return 0;
  let raw = pal.isDecay
    ? (paletteLv / (paletteLv + pal.denom)) * pal.coeff
    : paletteLv * pal.coeff;
  const g12 = saveData.gamingData && saveData.gamingData[12];
  for (let pi = 0; pi < PALETTE_SUPERBIT_PAIRS.length; pi++) {
    if (
      PALETTE_SUPERBIT_PAIRS[pi][1] === paletteIdx &&
      superBitType(PALETTE_SUPERBIT_PAIRS[pi][0], g12) === 1
    ) {
      raw *= 2 + 0.5 * superBitType(59, g12);
      break;
    }
  }
  const palLegendMulti = 1 + (legendPTSbonus(10, saveData) || 0) / 100;
  const loreFlag8 =
    Number(
      (saveData.spelunkData &&
        saveData.spelunkData[0] &&
        (saveData.spelunkData[0] as any)[8]) ||
        0
    ) >= 1
      ? 1
      : 0;
  const palLoreMulti = 1 + 0.5 * loreFlag8;
  return raw * palLegendMulti * palLoreMulti;
}

export const palette = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const val = computePaletteBonus(id, ctx.saveData);
    const paletteLv = Number(
      (ctx.saveData.spelunkData &&
        ctx.saveData.spelunkData[9] &&
        (ctx.saveData.spelunkData[9] as any)[id]) ||
        0
    );
    return node(
      label("Palette", id),
      val,
      [node("Palette Level", paletteLv, null, { fmt: "raw" })],
      { fmt: "+", note: "palette " + id }
    );
  },
};

// ===== BIG FISH BONUSES =====
let _bigFishBase: number[] | null = null;
function getBigFishBase(): number[] {
  if (_bigFishBase) return _bigFishBase;
  _bigFishBase = [];
  const raw = (Spelunky as any)[18];
  if (!raw) return _bigFishBase;
  for (let i = 0; i < raw.length; i++) {
    const parts = String(raw[i]).split(",");
    _bigFishBase.push(Number(parts[2]) || 0);
  }
  return _bigFishBase;
}

export function computeBigFishBonus(idx: number, saveData: SaveData): number {
  const fishLv = Number(
    (saveData.spelunkData &&
      saveData.spelunkData[11] &&
      (saveData.spelunkData[11] as any)[idx]) ||
      0
  );
  if (fishLv <= 0) return 0;
  const bases = getBigFishBase();
  const base = bases[idx] || 0;
  return (fishLv / (100 + fishLv)) * base;
}

export function shopUpgBonus(idx: number, saveData: SaveData): number {
  if (!saveData.spelunkData || !saveData.spelunkData[5]) return 0;
  const lv = Number((saveData.spelunkData[5] as any)[idx]) || 0;
  if (lv <= 0) return 0;
  if (!SpelunkUpg || !(SpelunkUpg as any)[idx]) return 0;
  return Number((SpelunkUpg as any)[idx][4]) * lv;
}

export function chapterBonus(
  chapterIdx: number,
  bonusIdx: number,
  saveData: SaveData
): number {
  const spelunk = saveData.spelunkData;
  if (!spelunk || !spelunk[8]) return 0;
  const lv = Number((spelunk[8] as any)[4 * chapterIdx + bonusIdx]) || 0;
  if (lv <= 0) return 0;
  const chData = (SpelunkChapters as any)[chapterIdx];
  if (!chData || !chData[bonusIdx]) return 0;
  const row = chData[bonusIdx];
  // Game multiplies by Sailing artifact 35 when row[4] === 1 — Stage 3 stubs
  // that to 1 (Sailing port is part of Stage 4).
  const dn = 1;
  return dn * formulaEval(row[3], Number(row[1]) || 0, Number(row[2]) || 0, lv);
}
