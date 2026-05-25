// ===== SAILING SYSTEM (W5) — DR-relevant slice =====
// Pragmatic port of computeArtifactBonus covering the artifacts the DR
// pipeline reads (16, 31, 32, 35, 37, 39). The full implementation in
// corgan-source has 130 lines of per-artifact scaling tied to talents,
// build speed, stats and meals — we cover the base + tier multiplier and
// the simple cases we need.

import { charClassData, divinityData } from "../../../save/data";
import { artifactBase } from "../../data/w5/sailing";
import { getLOG } from "../../../formulas";
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
