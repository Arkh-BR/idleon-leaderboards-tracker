// ===== SAILING SYSTEM (W5) — DR-relevant slice =====
// Pragmatic port of computeArtifactBonus covering the artifacts the DR
// pipeline reads (16, 31, 32, 35, 37, 39). The full implementation in
// corgan-source has 130 lines of per-artifact scaling tied to talents,
// build speed, stats and meals — we cover the base + tier multiplier and
// the simple cases we need.

import { charClassData, divinityData } from "../../../save/data";
import { artifactBase } from "../../data/w5/sailing";
import { getLOG } from "../../../formulas";
import { legendPTSbonus } from "../w7/spelunking";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function computeArtifactBonus(
  artIdx: number,
  ci: number,
  ctx: Ctx
): number {
  const saveData = ctx.saveData;
  const sailing = saveData.sailingData as any[];
  if (!sailing || !sailing[3]) return 0;
  const tier = Number((sailing[3] as any)?.[artIdx]) || 0;
  if (tier <= 0) return 0;
  let val = artifactBase(artIdx);

  if (artIdx === 3 || artIdx === 5) {
    const sailLv = Number(
      (saveData.lv0AllData as any)?.[ci >= 0 ? ci : 0]?.[13]
    ) || 0;
    val *= sailLv;
  } else if (artIdx === 13) {
    const highMeal = Number((saveData.mealsData as any)?.[2]?.[0]) || 1;
    val *= getLOG(highMeal);
  } else if (artIdx === 23) {
    const gamLv = Number(
      (saveData.lv0AllData as any)?.[ci >= 0 ? ci : 0]?.[15]
    ) || 0;
    val *= gamLv;
  } else if (artIdx === 27) {
    const sail1 = Number((sailing[1] as any)?.[0]) || 1;
    val *= getLOG(sail1);
  } else if (artIdx === 29) {
    const div39 = Number((divinityData as any)?.[39]) || 1;
    val *= getLOG(div39);
  }

  if (tier >= 2) val *= tier;

  return val;
}

// Silence unused-import warnings
void charClassData;

const num = (v: unknown): number => Number(v) || 0;

// @njs _customBlock_CaptBonusCalc
// Captain `captainIdx`'s level × value for each bonus slot (1 and 2) whose type
// is `type`. N.js indexes Captains[b] directly (throws on a missing row); a
// missing captain contributes 0 here.
export function captBonusCalc(type: number, captainIdx: number, s: SaveData): number {
  if (captainIdx < 0) return 0;
  const c = (s.captainsData as any[])?.[captainIdx];
  if (!c) return 0;
  let v = 0;
  if (c[1] == type) v += num(c[3]) * num(c[5]);
  if (c[2] == type) v += num(c[3]) * num(c[6]);
  return v;
}

// NONdummies[60]: how many of the first 30 captains are type 6.
export function captainsOfType6(s: SaveData): number {
  const caps = (s.captainsData as any[]) || [];
  let n = 0;
  for (let g = 0; g < Math.min(30, caps.length); g++) if (caps[g]?.[0] == 6) n++;
  return n;
}

// @njs NightmarinerTotLV
// Σ over the 20 boats of the loot + speed upgrades above 600. (N.js caches the
// sum in DNSM.NghMrTOT after the first call; we recompute it each time.)
export function nightmarinerTotLv(s: SaveData): number {
  const boats = (s.boatsData as any[]) || [];
  let t = 0;
  for (let e = 0; e < 20; e++) t += Math.max(0, num(boats[e]?.[3]) + num(boats[e]?.[5]) - 600);
  return t;
}

// @njs DaveyJonesBonus
// (1 + (50 × GemItemsPurchased[8] + LegendPTS 11) / 100) × (1 + 2 × clamp01(
//   ⌊(boat loot + speed upgrades + 99600) / 1e5⌋ × Grid_Bonus(105, 1))).
// Grid_Bonus(105, 1) is the raw grid level, rounded.
export function daveyJonesBonus(boatIdx: number, s: SaveData): number {
  const b = (s.boatsData as any[])?.[boatIdx];
  const grid = Math.round(num(s.gridLevels?.[105]));
  const tier = Math.floor((num(b?.[3]) + num(b?.[5]) + 99600) / 1e5) * grid;
  return (
    (1 + (50 * num(s.gemItemsData?.[8]) + legendPTSbonus(11, s)) / 100) *
    (1 + 2 * Math.max(0, Math.min(1, tier)))
  );
}
