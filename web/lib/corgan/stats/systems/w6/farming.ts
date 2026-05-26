// ===== FARMING SYSTEM (W6) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { mainframeBonus } from "../w4/lab";
import { vaultUpgBonus } from "../common/vault";
import { emporiumBonus } from "../../../game-helpers";
import { grimoireUpgBonus22 } from "../mc/grimoire";
import { exoticParams, ninjaInfo } from "../../data/w5/farming";
import { skillLvData, numCharacters } from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { computeAllTalentLVz } from "../common/talent";
import { talentParams } from "../../data/common/talent";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export function exoticBonusQTY40(saveData: SaveData): number {
  const lv = Number((saveData.farmUpgData as any)?.[60]) || 0;
  if (lv <= 0) return 0;
  return (20 * lv) / (1000 + lv);
}

function getbonus2Detail(
  talentIdx: number,
  data: { x1: number; x2: number; formula: string },
  activeCharIdx: number | undefined,
  saveData: SaveData
) {
  let best = 0;
  let bestCi = -1;
  let bestBase = 0;
  let bestBonus = 0;
  let bestEff = 0;
  for (let ci = 0; ci < numCharacters; ci++) {
    const sl = (skillLvData as any)[ci] || {};
    const rawLv = Number(sl[talentIdx] || sl[String(talentIdx)]) || 0;
    if (rawLv <= 0) continue;
    const bonusChar = activeCharIdx != null ? activeCharIdx : ci;
    const bonus = computeAllTalentLVz(rawLv, bonusChar, undefined, saveData);
    const effLv = rawLv + bonus;
    const val = formulaEval(data.formula, data.x1, data.x2, effLv);
    if (val > best) {
      best = val;
      bestCi = ci;
      bestBase = rawLv;
      bestBonus = bonus;
      bestEff = effLv;
    }
  }
  return { val: best, ci: bestCi, baseLv: bestBase, bonusLv: bestBonus, effLv: bestEff };
}

const TAL207 = talentParams(207);

export const farm = {
  resolve(id: string | number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;

    if (id === "rank9" || id === "rank19") {
      const rankIdx = id === "rank9" ? 9 : 19;
      // Rank 9 = the Drop Rate crop rank; 19 doesn't appear in the DR pool
      // today but keep symmetric naming if it ever lands there.
      const friendlyName =
        id === "rank9"
          ? `Crop Drop Rate Rank (Farming rank9)`
          : `Farming Rank 19 (Farming rank19)`;
      const ninjaArr = ninjaInfo(36);
      const ninjaVal = Number(ninjaArr[rankIdx]) || 0;
      const rankLv = Number(
        (saveData.farmRankData as any)?.["2"]?.[rankIdx]
      ) || 0;
      const d207 = TAL207
        ? getbonus2Detail(207, TAL207, ctx.charIdx, saveData)
        : { val: 0, ci: -1, baseLv: 0, bonusLv: 0, effLv: 0 };
      const tal207 = d207.val;
      const exotic14Lv = Number((saveData.farmUpgData as any)?.[34]) || 0;
      const exotic14 =
        exotic14Lv > 0 ? (60 * exotic14Lv) / (1000 + exotic14Lv) : 0;
      if (ninjaVal <= 0 || rankLv <= 0)
        return node(friendlyName, 0, null, { note: "farm " + id });
      const val =
        Math.max(1, tal207) * (1 + exotic14 / 100) * ninjaVal * rankLv;
      const talChildren =
        tal207 > 0
          ? [
              node("Best Character", d207.ci, null, { fmt: "raw" }),
              node("Base Level", d207.baseLv, null, { fmt: "raw" }),
              node("Bonus Level", d207.bonusLv, null, { fmt: "+" }),
              node("Effective Level", d207.effLv, null, { fmt: "raw" }),
            ]
          : null;
      return node(
        friendlyName,
        val,
        [
          node("Rank Level", rankLv, null, { fmt: "raw" }),
          node("Ninja Base", ninjaVal, null, { fmt: "raw" }),
          node(
            label("Talent", 207, " Bonus"),
            Math.max(1, tal207),
            talChildren,
            {
              fmt: "x",
              note: "decayMulti(2,200," + d207.effLv + ")",
            }
          ),
          node("Pommelyon Seed (Exotic 14) Bonus", 1 + exotic14 / 100, null, {
            fmt: "x",
            note: "Level " + exotic14Lv,
          }),
        ],
        { fmt: "+", note: "farm " + id }
      );
    }

    if (id === "cropSC7") {
      // cropSC7 = the W6 Crop Depot bonus tier 7 (drop rate from excess crops
      // past the first 100). Friendly name surfaces what it is, the
      // technical id stays as the splitEntityTag-recognised suffix.
      const cropSC7Name = `Crop Depot Bonus 7 (Farming cropSC7)`;
      const empUnlocked = emporiumBonus(
        38,
        saveData.ninjaData && (saveData.ninjaData[102] as any)?.[9]
      );
      if (!empUnlocked) {
        return node(
          cropSC7Name,
          0,
          [node("Emporium not unlocked", 0, null, { fmt: "raw" })],
          { note: "farm cropSC7" }
        );
      }
      const cropCount = saveData.farmCropCount || 0;
      const excess = Math.max(0, cropCount - 100);
      const mf17 = mainframeBonus(17, saveData);
      const grim22 = grimoireUpgBonus22(saveData);
      const exotic40Lv = Number((saveData.farmUpgData as any)?.[60]) || 0;
      const exotic40 =
        exotic40Lv > 0 ? (20 * exotic40Lv) / (1000 + exotic40Lv) : 0;
      const vault79 = vaultUpgBonus(79, saveData);
      const multi =
        (1 + mf17 / 100) * (1 + (grim22 + exotic40 + vault79) / 100);
      if (excess <= 0)
        return node(cropSC7Name, 0, null, { note: "farm cropSC7" });
      const val = excess * multi;
      return node(
        cropSC7Name,
        val,
        [
          node("Crop Count", cropCount, null, { fmt: "raw" }),
          node("Excess", excess, null, { fmt: "raw", note: "crops - 100" }),
          node(
            "Multi",
            multi,
            [
              node("Depot Studies PhD (Mainframe 17)", mf17, null, { fmt: "raw" }),
              node(
                "Superior Crop Research (Grimoire 22)",
                grim22,
                null,
                { fmt: "raw" }
              ),
              node(
                "SCIENTERRIFIC (Exotic 40)",
                exotic40,
                null,
                { fmt: "raw", note: "Level " + exotic40Lv }
              ),
              node(
                "Properly Funded Research (Vault 79)",
                vault79,
                null,
                { fmt: "raw" }
              ),
            ],
            { fmt: "x" }
          ),
        ],
        { fmt: "+", note: "farm cropSC7" }
      );
    }

    if (id === "exotic59") {
      const lv = Number((saveData.farmUpgData as any)?.[79]) || 0;
      if (lv <= 0)
        return node("POMMELION SEED (Exotic 59)", 0, null, { note: "farm exotic59" });
      const val = (25 * lv) / (1000 + lv);
      return node(
        "POMMELION SEED (Exotic 59)",
        val,
        [
          node("Level", lv, null, { fmt: "raw" }),
          node("Formula Result", val, null, {
            fmt: "raw",
            note: "25 × lv / (1000 + lv)",
          }),
        ],
        { fmt: "+", note: "farm exotic59" }
      );
    }

    return node("Farm " + id, 0, null, { note: "farm " + id });
  },
};

export function computeExoticBonus(idx: number, saveData: SaveData): number {
  const ex = exoticParams(idx);
  if (!ex || ex.base === 0) return 0;
  const lv = Number((saveData.farmUpgData as any)?.[ex.farmSlot]) || 0;
  if (lv <= 0) return 0;
  return (ex.base * lv) / (ex.denom + lv);
}
