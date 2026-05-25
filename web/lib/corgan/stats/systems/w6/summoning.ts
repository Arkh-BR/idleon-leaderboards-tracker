// ===== SUMMONING SYSTEM (W6) =====
// 1:1 port of corgan-source/js/stats/systems/w6/summoning.js. Adds the
// winBonus resolver used by the DR descriptor.

import { node, treeResult, type CorganNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { artifactBase } from "../../data/w5/sailing";
import { equipSetBonus } from "../../data/common/equipment";
import { SummonUPG } from "../../data/game/customlists.js";
import {
  SUMMON_ENDLESS_TYPE,
  SUMMON_ENDLESS_VAL,
  SUMMON_NORMAL_BONUS,
} from "../../data/w7/summon";
import { achieveStatus } from "../common/achievement";
import { computeEmperorBon } from "./emperor";
import { maxTalentBonus } from "../common/talent";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function computeSummWinBonus(saveData: SaveData): number[] {
  const bonus = new Array(32).fill(0);
  if (!saveData || !saveData.summonData) return bonus;
  const normalWins = (saveData.summonData[1] || []) as any[];
  for (let i = 0; i < normalWins.length; i++) {
    const name = normalWins[i];
    if (typeof name !== "string" || name.startsWith("rift")) continue;
    const entry = SUMMON_NORMAL_BONUS[name];
    if (!entry) continue;
    const bonusIdx = Math.round(entry[0] - 1);
    if (bonusIdx >= 0 && bonusIdx < 32) bonus[bonusIdx] += entry[1];
  }
  const endlessWins = Number((saveData.olaData as any)?.[319]) || 0;
  for (let i = 0; i < endlessWins; i++) {
    const idx = i % 40;
    const type = (SUMMON_ENDLESS_TYPE[idx] || 0) - 1;
    if (type >= 0 && type < 32) bonus[type] += SUMMON_ENDLESS_VAL[idx] || 0;
  }
  return bonus;
}

type WinBonusParts = {
  val: number;
  raw: number;
  simple?: boolean;
  baseMult?: number;
  pristine8?: number;
  pristineMult?: number;
  gemItems11?: number;
  gemMult?: number;
  artBonus32?: number;
  artRarity?: number;
  taskVal?: number;
  ach379?: number;
  ach373?: number;
  wb31?: number;
  empBon8?: number;
  godshardSet?: number;
  winnerSum?: number;
  winnerMult?: number;
  idx?: number;
};

function _winBonusParts(idx: number, swb: number[], saveData: SaveData): WinBonusParts {
  const raw = swb[idx] || 0;
  if (raw <= 0) return { val: 0, raw: 0 };
  if (idx === 20 || idx === 22 || idx === 24 || idx === 31)
    return { val: raw, raw, simple: true };
  const pristine8 =
    saveData.ninjaData && (saveData.ninjaData[107] as any)?.[8] === 1 ? 30 : 0;
  const gemItems11 = Number((saveData.gemItemsData as any)?.[11]) || 0;
  const artRarity =
    Number((saveData.sailingData as any)?.[3]?.[32]) || 0;
  const artBonus32 = artRarity > 0 ? artifactBase(32) * artRarity : 0;
  const taskVal = Math.min(
    10,
    Number((saveData.tasksGlobalData as any)?.[2]?.[5]?.[4]) || 0
  );
  const wb31 = swb[31] || 0;
  const empBon8 = computeEmperorBon(8, saveData);
  const godshardSet = String((saveData.olaData as any)?.[379] ?? "").includes(
    "GODSHARD_SET"
  )
    ? equipSetBonus("GODSHARD_SET")
    : 0;
  const ach379 = achieveStatus(379, saveData);
  const ach373 = achieveStatus(373, saveData);
  const baseMult = idx >= 20 && idx <= 33 ? 1 : 3.5;
  const pristineMult = 1 + pristine8 / 100;
  const gemMult = 1 + (10 * gemItems11) / 100;
  let winnerSum = artBonus32 + taskVal + ach379 + ach373 + godshardSet;
  if (idx !== 19) winnerSum += wb31 + empBon8;
  const winnerMult = 1 + winnerSum / 100;
  const val = baseMult * raw * pristineMult * gemMult * winnerMult;
  return {
    val, raw, baseMult, pristine8, pristineMult, gemItems11, gemMult,
    artBonus32, artRarity, taskVal, ach379, ach373, wb31, empBon8,
    godshardSet, winnerSum, winnerMult, idx,
  };
}

export function computeWinBonus(
  idx: number,
  opts: { noArt32?: boolean } | null,
  saveData: SaveData
): number {
  const swb = computeSummWinBonus(saveData);
  const p = _winBonusParts(idx, swb, saveData);
  if (opts && opts.noArt32 && (p.artBonus32 || 0) > 0) {
    const ws = (p.winnerSum || 0) - (p.artBonus32 || 0);
    return (
      (p.baseMult || 0) * p.raw * (p.pristineMult || 1) * (p.gemMult || 1) *
      (1 + ws / 100)
    );
  }
  return p.val;
}

export function computeSummUpgBonus(t: number, saveData: SaveData): TreeResult {
  const level = Number((saveData.summonData as any)?.[0]?.[t]) || 0;
  if (level <= 0) return treeResult(0);
  const perLv = Number((SummonUPG as any)[t]?.[6]) || 0;
  if (perLv <= 0) return treeResult(0);
  let moltoz = 1;
  const moltozChildren: CorganNode[] = [];
  const gilded = saveData.holesData && (saveData.holesData[28] as any[] | undefined);
  if (gilded && gilded.indexOf(t) !== -1) {
    moltoz = 2;
    const tal597 = maxTalentBonus(597, undefined, saveData);
    const tal597Add = Math.max(0, tal597 / 100 - 1);
    let bonus78 = 0;
    if (t !== 78) {
      const lv78 = Number((saveData.summonData as any)?.[0]?.[78]) || 0;
      const pLv78 = Number((SummonUPG as any)[78]?.[6]) || 0;
      bonus78 = lv78 * pLv78;
    }
    moltoz += tal597Add + bonus78 / 100;
    moltozChildren.push(node("Gilded Base", 2, null, { fmt: "raw" }));
    if (tal597Add > 0)
      moltozChildren.push(node("Talent 597", tal597Add, null, { fmt: "raw" }));
    if (bonus78 > 0)
      moltozChildren.push(node("Bonus78 (" + bonus78 + "/100)", bonus78 / 100, null, { fmt: "raw" }));
  }
  const stoneEligible = Number((SummonUPG as any)[t]?.[10]) || 0;
  if (stoneEligible === 1) {
    const stoneType = Number((SummonUPG as any)[t]?.[2]) || 0;
    const kr = saveData.krBestData as any;
    const trialVal = kr && kr["SummzTrz" + stoneType] ? Number(kr["SummzTrz" + stoneType]) : 0;
    if (trialVal > 0) {
      moltoz *= 1 + trialVal;
      moltozChildren.push(
        node("Stone Trial (" + stoneType + ")", 1 + trialVal, null, { fmt: "x" })
      );
    }
  }
  const val = moltoz * level * perLv;
  return treeResult(val, [
    node("Level", level, null, { fmt: "raw" }),
    node("Per Level", perLv, null, { fmt: "raw" }),
    node("Moltoz Multi", moltoz, moltozChildren.length ? moltozChildren : null, { fmt: "x" }),
  ]);
}

export const winBonus = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const swb = computeSummWinBonus(saveData);
    const p = _winBonusParts(id, swb, saveData);
    if (p.val <= 0)
      return node(label("Summoning", id), 0, null, { note: "summoning win " + id });

    if (p.simple) {
      return node(
        label("Summoning", id),
        p.val,
        [node("Win Bonus Raw", p.raw, null, { fmt: "raw" })],
        { fmt: "+", note: "summoning win " + id }
      );
    }

    const winnerSumParts: CorganNode[] = [
      node(label("Artifact", 32), p.artBonus32 || 0, null, {
        fmt: "raw",
        note: "rarity=" + (p.artRarity || 0),
      }),
      node("Task Shop", p.taskVal || 0, null, { fmt: "raw" }),
      node(label("Achievement", 379), p.ach379 || 0, null, { fmt: "raw" }),
      node(label("Achievement", 373), p.ach373 || 0, null, { fmt: "raw" }),
    ];
    if (id !== 19) {
      winnerSumParts.push(node("Win Bonus 31", p.wb31 || 0, null, { fmt: "raw" }));
      winnerSumParts.push(node("Emperor Bon 8", p.empBon8 || 0, null, { fmt: "raw" }));
    }
    winnerSumParts.push(node("Godshard Set", p.godshardSet || 0, null, { fmt: "raw" }));
    return node(
      label("Summoning", id),
      p.val,
      [
        node("Win Bonus Raw", p.raw, null, { fmt: "raw" }),
        node("Base Multiplier", p.baseMult || 1, null, { fmt: "x" }),
        node(label("Pristine", 8), p.pristineMult || 1, null, {
          fmt: "x",
          note: (p.pristine8 || 0) > 0 ? "Equipped" : "Not equipped",
        }),
        node("Gem Shop Bonus", p.gemMult || 1, null, {
          fmt: "x",
          note: "items=" + (p.gemItems11 || 0),
        }),
        node("Winner Multi", p.winnerMult || 1, winnerSumParts, { fmt: "x" }),
      ],
      { fmt: "+", note: "summoning win " + id }
    );
  },
};
