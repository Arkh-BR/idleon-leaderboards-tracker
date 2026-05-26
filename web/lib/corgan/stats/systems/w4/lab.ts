// ===== LAB SYSTEM (W4) =====
// Pragmatic port: covers what the DR descriptor reads — chip, grid,
// charHasChip, mainframeBonus. The full computeLabConnectivity BFS
// (250+ lines of pixel-distance pathfinding through 12 player pads,
// jewel positions, dynamic emporium-bonus pads) is omitted; saveData
// keeps the loader's empty defaults for labMainBonusFull/labBonusConnected/
// labJewelConnected, so mainframeBonus reports inactive values everywhere.
// That underestimates a few DR terms (e.g. Certified Stamp Book ×2). Stage 5
// will swap in the real BFS once the descriptor lands.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { labData, numCharacters } from "../../../save/data";
import { JEWEL_DESC, LAB_BONUS_BASE, LAB_BONUS_DYNAMIC } from "../../data/w4/lab";
import { chipBonusValue } from "../../data/w4/chips";
import { gridBonusPerLv, SHAPE_BONUS_PCT } from "../../data/w7/research";
import { cloudBonus, emporiumBonus } from "../../../game-helpers";
import { companionBonus } from "../../data/common/companions";
import { companionChild } from "../common/companions";
import { ChipDesc } from "../../data/game/customlists.js";
import { labJewelUnlocked } from "../../../save/helpers";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

// Friendly grid (Research Square) names sourced from
// researchGridSquares[i].name in IT website-data.
const GRID_NAMES: Record<number, string> = {
  168: "Glimbo Insider Trading Secrets",
  172: "Well Dressed",
  173: "Divine Design",
};
function gridLabel(id: number): string {
  const n = GRID_NAMES[id];
  return n ? `${n} (Grid ${id})` : label("Grid", id);
}

// Compute the raw grid bonus value (additive %, e.g. 73.8 for Grid 172 Lv 2).
// Mirrors corgan-source gbWith(): perLv × lv × (1 + shape%/100) × allBonusMulti.
// Returns 0 if grid is unleveled.
export function gridBonusValue(id: number, saveData: SaveData): number {
  const gridLv = Number((saveData.gridLevels as any)?.[id]) || 0;
  if (gridLv < 1) return 0;
  const si = Number((saveData.shapeOverlay as any)?.[id]);
  const shapePct =
    si >= 0 && si < SHAPE_BONUS_PCT.length ? SHAPE_BONUS_PCT[si] : 0;
  const shapeMult = 1 + shapePct / 100;
  const am = gridAllMulti(saveData);
  const bonusPerLv = gridBonusPerLv(id) || 25;
  return bonusPerLv * gridLv * shapeMult * Math.max(1, am.val);
}

function gridAllMulti(saveData: SaveData) {
  const comp55 =
    saveData.companionIds && saveData.companionIds.has(55) ? companionBonus(55) : 0;
  const comp0 =
    saveData.companionIds && saveData.companionIds.has(0) ? companionBonus(0) : 0;
  const grid173Lv = Number((saveData.gridLevels as any)?.[173]) || 0;
  const cb71 = cloudBonus(71, saveData.weeklyBossData);
  const cb72 = cloudBonus(72, saveData.weeklyBossData);
  const cb76 = cloudBonus(76, saveData.weeklyBossData);
  const sum =
    comp55 + 5 * Math.min(1, grid173Lv * comp0) + cb71 + cb72 + cb76;
  return {
    val: 1 + sum / 100,
    comp55,
    comp0,
    grid173Lv,
    cb71,
    cb72,
    cb76,
  };
}

export const grid = {
  resolve(id: number, ctx: Ctx, _args?: unknown): CorganNode {
    const saveData = ctx.saveData;
    const gridLv = Number((saveData.gridLevels as any)?.[id]) || 0;
    if (gridLv < 1) return node(gridLabel(id), 0, null, { note: "grid " + id });

    const si = Number((saveData.shapeOverlay as any)?.[id]);
    const shapePct =
      si >= 0 && si < SHAPE_BONUS_PCT.length ? SHAPE_BONUS_PCT[si] : 0;
    const shapeMult = 1 + shapePct / 100;
    const am = gridAllMulti(saveData);
    const allMulti = am.val;

    const bonusPerLv = gridBonusPerLv(id) || 25;
    const rawVal = bonusPerLv * gridLv;
    const val = rawVal * shapeMult * Math.max(1, allMulti);

    const allMultiChildren: CorganNode[] = [];
    if (am.comp55 > 0)
      allMultiChildren.push(
        companionChild(55, am.comp55, saveData, {
          fmt: "raw",
          note: "companion 55",
        })
      );
    if (am.comp0 > 0)
      allMultiChildren.push(
        node(
          label("Companion", 0),
          5 * Math.min(1, am.grid173Lv * am.comp0),
          [node(`${gridLabel(173)} Lv`, am.grid173Lv, null, { fmt: "raw" })],
          { fmt: "raw", note: "companion 0" }
        )
      );

    if (id === 168) {
      const trades = ((saveData.research as any)?.[12] as any[]) || [];
      let totalTrades = 0;
      for (let i = 0; i < trades.length; i++)
        totalTrades += Number(trades[i]) || 0;
      const tradeGroups = Math.floor(totalTrades / 100);
      const glimboVal = 1 + (val * tradeGroups) / 100;
      return node(
        "Glimbo DR Multi",
        glimboVal,
        [
          node(`${gridLabel(168)} Level`, gridLv, null, { fmt: "raw" }),
          node("Shape Bonus", shapeMult, null, { fmt: "x", note: "shape=" + si }),
          node(
            "All Multi",
            allMulti,
            allMultiChildren.length ? allMultiChildren : null,
            { fmt: "x" }
          ),
          node("Total Trades", totalTrades, null, {
            fmt: "raw",
            note: tradeGroups + " groups",
          }),
        ],
        { fmt: "x", note: "grid 168" }
      );
    }

    return node(
      gridLabel(id),
      val,
      [
        node("Grid Level", gridLv, null, { fmt: "raw" }),
        node("Base per Level", rawVal, null, {
          fmt: "raw",
          note: bonusPerLv + "/level",
        }),
        node("Shape Bonus", shapeMult, null, { fmt: "x", note: "shape=" + si }),
        node(
          "All Multi",
          Math.max(1, allMulti),
          allMultiChildren.length ? allMultiChildren : null,
          { fmt: "x" }
        ),
      ],
      { fmt: "+", note: "grid " + id }
    );
  },
};

export const chip = {
  resolve(id: string | number, ctx: Ctx): CorganNode {
    const chipSlots = (labData as any)[1 + ctx.charIdx];
    if (!chipSlots) return node("Lab Chip DR", 0, null, { note: "chip " + id });
    let total = 0;
    const children: CorganNode[] = [];
    for (let i = 0; i < 7; i++) {
      if (id === "dr" && Number(chipSlots[i]) === 3) {
        const _chipVal = chipBonusValue(3);
        total += _chipVal;
        children.push(
          node("Slot " + i + " Grounded Processor", _chipVal, null, {
            fmt: "+",
            note: "chip 3",
          })
        );
      }
    }
    return node("Lab Chip DR", total, children, { fmt: "+", note: "chip " + id });
  },
};

// ===== MAINFRAME BONUS (simplified — no BFS connectivity) =====
// Returns the active value if labBonusConnected/labJewelConnected indicate
// the node is reachable, else the inactive value. Until Stage 5's BFS
// lands, both arrays default to empty so this returns 0 for most calls.

// 1:1 port of corgan-source mainframeBonus. Recursive (e=8 reads e=119, e=9
// reads e=113, jewels multiply by mfb(8) etc.).
export function mainframeBonus(e: number, saveData: SaveData): number {
  const lmbFull = (saveData as any).labMainBonusFull as any[] | undefined;
  if (!lmbFull) return 0;
  const lmbLen = lmbFull.length;
  if (e < 100) {
    if (e >= lmbLen) return 0;
    const labBonusConnected = (saveData as any).labBonusConnected as any[];
    if (!labBonusConnected || !labBonusConnected[e]) return lmbFull[e][3];
    const active = lmbFull[e][4];
    if (e === 9) {
      const base9 = active + mainframeBonus(113, saveData);
      // Total green mushroom kills feeds mainframeBonus(9); not implemented here.
      // Returning base9 underestimates slightly when this is queried but no DR
      // path uses mfb(9) directly.
      return base9;
    }
    if (e === 0) {
      // Breeding pet count multi — not ported (not in DR path)
      return active;
    }
    if (e === 3) return active + mainframeBonus(107, saveData);
    if (e === 11) return active + mainframeBonus(117, saveData);
    if (e === 13) return active;
    if (e === 15) return active + mainframeBonus(118, saveData);
    if (e === 17) return active + mainframeBonus(120, saveData);
    if (e === 8) return active + mainframeBonus(119, saveData) / 100;
    return active;
  }
  const ji = e - 100;
  if (ji < 0 || ji >= JEWEL_DESC.length) return 0;
  const labJewelConnected = (saveData as any).labJewelConnected as any[];
  if (!labJewelConnected || !labJewelConnected[ji]) return 0;
  const base = JEWEL_DESC[ji][2];
  if (e === 119) return base;
  // Jewel doubling: certain jewels get ×2 if all adjacent jewels are active
  let doubler = 1;
  if (
    e === 100 &&
    mainframeBonus(101, saveData) > 0 &&
    mainframeBonus(102, saveData) > 0
  )
    doubler = 2;
  else if (
    e === 103 &&
    mainframeBonus(104, saveData) > 0 &&
    mainframeBonus(105, saveData) > 0 &&
    mainframeBonus(106, saveData) > 0
  )
    doubler = 2;
  else if (
    e === 110 &&
    mainframeBonus(107, saveData) > 0 &&
    mainframeBonus(108, saveData) > 0 &&
    mainframeBonus(109, saveData) > 0
  )
    doubler = 2;
  else if (
    e === 112 &&
    mainframeBonus(111, saveData) > 0 &&
    mainframeBonus(113, saveData) > 0 &&
    mainframeBonus(114, saveData) > 0 &&
    mainframeBonus(115, saveData) > 0
  )
    doubler = 2;
  return doubler * base * mainframeBonus(8, saveData);
}

// Builds labMainBonusFull = base entries + active emporium-unlocked dynamic entries.
// Matches corgan-source buildLabMainBonus().
function buildLabMainBonus(saveData: SaveData): any[][] {
  const lmb: any[][] = LAB_BONUS_BASE.map((e) => e.slice());
  for (let i = 0; i < LAB_BONUS_DYNAMIC.length; i++) {
    const dyn = LAB_BONUS_DYNAMIC[i];
    const empKey = (dyn as any)[6] as number;
    const ninjaArr =
      (saveData as any).ninjaData &&
      (saveData as any).ninjaData[102] &&
      (saveData as any).ninjaData[102][9];
    if (emporiumBonus(empKey, ninjaArr)) {
      lmb.push([dyn[0], dyn[1], dyn[2], dyn[3], dyn[4], dyn[5]]);
    }
  }
  return lmb;
}

// Simplified port of corgan-source computeLabConnectivity(): we skip the full
// player-position / euclidDist BFS and assume max-level lab connectivity for
// end-game characters (all main bonuses connected, all unlocked jewels active).
// Trade-off: over-estimates for characters who haven't built lab connectivity yet,
// but unblocks Stamp Doubler (Certified Stamp Book ×2), Cook Multi (Mainframe 116),
// and other downstream calcs that depend on mainframeBonus().
export function computeLabConnectivity(saveData: SaveData): Record<string, unknown> {
  const lmb = buildLabMainBonus(saveData);
  // Assume all main bonuses are connected (max-level lab approximation)
  const labBonusConnected = new Array(lmb.length).fill(1);
  // Jewels: only count as connected if they're actually unlocked in saveData
  const labJewelConnected = new Array(JEWEL_DESC.length)
    .fill(0)
    .map((_, ji) => (labJewelUnlocked(ji) ? 1 : 0));
  return {
    labMainBonusFull: lmb,
    labBonusConnected,
    labJewelConnected,
  };
}

// ===== CHIP BY KEY =====
export function computeChipBonus(effectKey: string): number {
  if (!labData) return 0;
  let total = 0;
  for (let ci = 0; ci < numCharacters; ci++) {
    const chips = (labData as any)[1 + ci];
    if (!chips) continue;
    for (let slot = 0; slot < chips.length; slot++) {
      const chipType = Number(chips[slot]) || 0;
      if (chipType <= 0) continue;
      if (!(ChipDesc as any)[chipType]) continue;
      const chipKey = (ChipDesc as any)[chipType][10];
      if (chipKey !== effectKey) continue;
      total += Number((ChipDesc as any)[chipType][11]) || 0;
    }
  }
  return total;
}

export function charHasChip(charIdx: number, effectKey: string): boolean {
  if (!labData) return false;
  const chips = (labData as any)[1 + charIdx];
  if (!chips) return false;
  for (let slot = 0; slot < chips.length; slot++) {
    const chipType = Number(chips[slot]) || 0;
    if (chipType <= 0) continue;
    if (!(ChipDesc as any)[chipType]) continue;
    if ((ChipDesc as any)[chipType][10] === effectKey) return true;
  }
  return false;
}
