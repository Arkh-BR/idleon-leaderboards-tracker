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
