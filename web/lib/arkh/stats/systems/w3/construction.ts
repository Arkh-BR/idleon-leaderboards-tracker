// ===== CONSTRUCTION SYSTEM (W3) — shrine slice =====
// The full construction.js port is large (~408 lines) and most of it
// belongs to other descriptors (build spd, flaggy, cog bonuses,
// salt lick). For DR we only need `shrine.resolve()`. Stage 4/5 can
// extend this with the remaining helpers when needed.

import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { computeCardLvDetail } from "../common/cards";
import { shrineBase, shrinePerLevel } from "../../data/w3/shrine";
import { BOSS3B_CARD_PCT } from "../../data/game-constants";
import { currentMapData } from "../../../save/data";
import { computeArtifactBonus } from "../w5/sailing";
import { mainframeBonus } from "../w4/lab";
import { postOfficeData, skillLvData } from "../../../save/data";
import { formulaEval, getLOG } from "../../../formulas";
import { talentParams } from "../../data/common/talent";
import { bubbleValByKey, computeVialByKey } from "../w2/alchemy";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { guild } from "../common/guild";
import { etcBonus } from "../common/etcBonus";
import { achieveStatus } from "../common/achievement";
import { arcadeBonus } from "../w2/arcade";
import { votingBonusz } from "../w2/voting";
import { votingMulti } from "../coin/votingMulti";
import { vaultUpgBonus } from "../common/vault";
import { vaultKillzTotal } from "../coin/accountKills";
import { bubbaRoGBonus } from "../exp/bubba";
import { computeWinBonus } from "../w6/summoning";
import { computePaletteBonus } from "../w7/spelunking";
import { atomBonus1, invStorageOwned } from "../w6/upg-totals";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const SHRINE_DATA: Record<number, { base: number; perLevel: number }> = {
  4: { base: shrineBase(4), perLevel: shrinePerLevel(4) },
};

export const shrine = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const data = SHRINE_DATA[id];
    if (!data)
      return node(label("Shrine", id), 0, null, { note: "shrine " + id });
    const name = label("Shrine", id);
    const saveData = ctx.saveData;
    const shrineArr = saveData.shrineData && (saveData.shrineData[id] as any);
    if (!shrineArr) return node(name, 0, null, { note: "shrine " + id });
    const shrineLv = Number(shrineArr[3]) || 0;
    if (shrineLv <= 0) return node(name, 0, null, { note: "shrine " + id });

    const cd = computeCardLvDetail("Boss3B", saveData);
    const boss3bLv = cd.lv;
    const cardMulti = 1 + (BOSS3B_CARD_PCT * boss3bLv) / 100;
    const baseBonus = (shrineLv - 1) * data.perLevel + data.base;
    const val = cardMulti * baseBonus;

    const cardChildren =
      boss3bLv > 0
        ? [
            node("Card Qty", cd.qty, null, { fmt: "raw" }),
            node("Card Lv", cd.lv, null, { fmt: "raw" }),
            node("Max Stars", cd.maxStars, null, { fmt: "raw" }),
          ]
        : null;

    return node(
      name,
      val,
      [
        node("Shrine Level " + shrineLv, baseBonus, null, {
          fmt: "+",
          note: data.base + " base + " + data.perLevel + "/level",
        }),
        node("Chaotic Chizoar (Card Boss3B)", cardMulti, cardChildren, {
          fmt: "x",
          note: `+${BOSS3B_CARD_PCT}% shrine effect per card level`,
        }),
      ],
      { fmt: "+", note: "shrine " + id }
    );
  },
};

// @njs _customBlock_Shrine
/** N.js Shrine(i) (@7828132): a placed shrine (level > .5) counts only when
 *  Artifact 0 is owned, it stands on the current map, or Mainframe 5 is on
 *  and it's in the same world (map / 50). The map is ctx.mapIdx when given,
 *  else the character's saved CurrentMap. */
export function computeShrine(idx: number, ci: number, ctx: { saveData: SaveData; mapIdx?: number }): number {
  const saveData = ctx.saveData;
  const row = (saveData.shrineData as any)?.[idx];
  const shrineLv = Number(row?.[3]) || 0;
  if (!(shrineLv > 0.5)) return 0;
  const map = ctx.mapIdx ?? (Number((currentMapData as any)?.[ci]) || 0);
  const at = Number(row?.[0]) || 0;
  const on =
    computeArtifactBonus(0, ci, ctx) >= 1 ||
    map === at ||
    (mainframeBonus(5, saveData) === 1 && Math.floor(map / 50) === Math.floor(at / 50));
  if (!on) return 0;
  const base = shrineBase(idx);
  const perLv = shrinePerLevel(idx);
  const rawVal = base + perLv * (shrineLv - 1);
  const cd = computeCardLvDetail("Boss3B", saveData);
  const boss3bMulti = 1 + (BOSS3B_CARD_PCT * cd.lv) / 100;
  return rawVal * boss3bMulti;
}

// @njs ConstMasteryBonus
/** N.js WorkbenchStuff("ConstMasteryBonus", b) for b 1 and 2 (@7802747):
 *  from Rift 40, Σ the 27 tower levels (GenINFO[111]) past the
 *  GenINFO[112] threshold — b 1: 2 per 10 over 750, b 2: 5 per 10 over 1250. */
export function constMasteryBonus(b: 1 | 2, s: SaveData): number {
  if ((Number((s.riftData as any)?.[0]) || 0) < 40) return 0;
  let lv = 0;
  for (let i = 0; i < 27; i++) lv += Number((s.towerData as any)?.[i]) || 0;
  return b === 1 ? Math.max(0, 2 * Math.floor((lv - 750) / 10)) : Math.max(0, 5 * Math.floor((lv - 1250) / 10));
}

// @njs PlayerBuildSpd
/** N.js WorkbenchStuff("PlayerBuildSpd", p) (@7814745), the inventory-loaded
 *  branch: player p's construction level and Post Office box 17 and raw talent
 *  131 level; everything else (bubbles, equipment, vote…) is the active
 *  character `ci`'s, as the game reads its DNSM caches. */
export function playerBuildSpd(p: number, ci: number, ctx: { saveData: SaveData; charIdx?: number }): number {
  const s = ctx.saveData;
  const tctx = { ...ctx, charIdx: ci, activeCharIdx: ci } as any;
  const conLv = Number((s.lv0AllData as any)?.[p]?.[8]) || 0;
  const f = 3 * Math.pow(conLv / 2 + 0.7, 1.6);
  const g = 1 + (conLv * bubbleValByKey("Construction", ci, s).val) / 100;
  const add =
    computeStampBonusOfTypeX("BuildProd", s).val +
    0.25 * (Number((postOfficeData as any)?.[p]?.[17]) || 0) + // PostOfficeInfo[17][0] = POu_p[17]
    (Number(guild.resolve(5, tctx).val) || 0) +
    (Number(etcBonus.resolve("30", tctx).val) || 0) +
    Math.min(5, 5 * achieveStatus(153, s)) +
    constMasteryBonus(2, s) +
    computeVialByKey("Contspd", s).val +
    arcadeBonus(44, s).val +
    votingBonusz(18, votingMulti(tctx), s) +
    vaultUpgBonus(48, s) * vaultKillzTotal(11, s) +
    bubbaRoGBonus(1, s);
  const multi =
    (1 + computeWinBonus(13, null, s) / 100) *
    (1 + computePaletteBonus(25, s) / 100) *
    (1 + computeVialByKey("6turtle", s).val / 100);
  const t131 = talentParams(131);
  const lv131 = Number((skillLvData as any)?.[p]?.[131]) || 0;
  const redox = t131 ? formulaEval(t131.formula, t131.x1, t131.x2, lv131) : 0;
  return f * g * (1 + add / 100) * multi * (1 + (redox * (atomBonus1(s) + getLOG(invStorageOwned(s, "Refinery1")))) / 100);
}
