import { computeArkhDropRate } from "../../../lib/arkh/computeDR";
import { computeTome } from "../../../lib/tome/compute";
import { computeTalentTreesForChars } from "../../../lib/talentsLevel/compute";
import { loadSaveData } from "../../../lib/arkh/save/loader";
import { saveData } from "../../../lib/arkh/state";
import { expRateTree } from "../../../lib/cookingMastery/tree";
import type { EngineSummary } from "./checks";

// Fixed talent probe (char 0): DR talents — stable across saves, enough to
// catch a talent-formula regression.
const TALENT_PROBE = { charIdx: 0, talentIds: [279, 24, 655] };

export function summarize(save: any): EngineSummary {
  // Tome (also yields per-task for ground-truth).
  // rows are in TASK ORDER (position i in the loop), which matches
  // extraData.tomePoints indexing — so we index by row position, not computeIdx.
  //
  // CRITICAL: defeat the IT-points override. computeTome normally overwrites
  // its own per-task pts with parsedData.tomePoints when that array is present
  // (so the UI matches idleontoolbox.com exactly). But fetched reference saves
  // CARRY parsedData.tomePoints, so leaving the override on would make
  // tomeByTask echo the very reference we validate against in run.ts — a
  // tautology that passes regardless of port correctness. Strip it so
  // tomeByTask reflects the engine's INDEPENDENT computation.
  const saveForTome =
    save && save.parsedData
      ? { ...save, parsedData: { ...save.parsedData, tomePoints: undefined } }
      : save;
  const tome = computeTome(saveForTome);
  const tomeByTask: number[] = [];
  for (let i = 0; i < tome.rows.length; i++) {
    const r = tome.rows[i];
    tomeByTask[i] = r.pts ?? 0;
  }

  // DR: max over all chars (the game/IT dropRate ground-truth is the best
  // char, not char 0). mapIdx=0 (no map bonus), so ground-truth must use a
  // loose tolerance — the reference value includes the active char's map.
  let drTotal = 0;
  const nChars = Array.isArray(save.charNames) ? save.charNames.length : 1;
  for (let c = 0; c < nChars; c++) {
    try {
      drTotal = Math.max(drTotal, computeArkhDropRate(save, c, 0).total);
    } catch {
      /* skip chars that error in this context */
    }
  }

  // Cooking exp-rate (expRateTree needs the arkh state loaded).
  loadSaveData(save);
  const cookingExp = expRateTree(saveData).val;

  // Talents: sum effective levels over the probe set.
  let talentsTotal = 0;
  const trees = computeTalentTreesForChars(save, [TALENT_PROBE]);
  for (const c of trees) for (const node of c.trees.values()) talentsTotal += node.val || 0;

  return { tomeByTask, tomeTotal: tome.totalPts, drTotal, cookingExp, talentsTotal };
}
