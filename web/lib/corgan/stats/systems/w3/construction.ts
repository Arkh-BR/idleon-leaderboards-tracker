// ===== CONSTRUCTION SYSTEM (W3) — shrine slice =====
// The full construction.js port is large (~408 lines) and most of it
// belongs to other descriptors (build spd, flaggy, cog bonuses,
// salt lick). For DR we only need `shrine.resolve()`. Stage 4/5 can
// extend this with the remaining helpers when needed.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { computeCardLvDetail } from "../common/cards";
import { shrineBase, shrinePerLevel } from "../../data/w3/shrine";
import { BOSS3B_CARD_PCT } from "../../data/game-constants";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const SHRINE_DATA: Record<number, { base: number; perLevel: number }> = {
  4: { base: shrineBase(4), perLevel: shrinePerLevel(4) },
};

export const shrine = {
  resolve(id: number, ctx: Ctx): CorganNode {
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

export function computeShrine(idx: number, saveData: SaveData): number {
  const shrineLv = Number(
    (saveData.shrineData && (saveData.shrineData as any)[idx]?.[3]) || 0
  );
  if (shrineLv <= 0) return 0;
  const base = shrineBase(idx);
  const perLv = shrinePerLevel(idx);
  const rawVal = base + perLv * (shrineLv - 1);
  const cd = computeCardLvDetail("Boss3B", saveData);
  const boss3bMulti = 1 + (BOSS3B_CARD_PCT * cd.lv) / 100;
  return rawVal * boss3bMulti;
}
