// ===== OWL SYSTEM (W1) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { optionsListData } from "../../../save/data";
import { legendPTSbonus } from "../w7/spelunking";
import { companionBonus } from "../../data/common/companions";
import { OWL_BASE } from "../../data/game-constants";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export const owl = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const base = OWL_BASE[id] || 1;
    const ola255 = Number((optionsListData as any)?.[255]) || 0;
    const rawCount = Math.max(0, Math.ceil((ola255 - id) / 6));
    if (rawCount <= 0) return node("Summoning Owl", 0, null, { note: "owl " + id });

    const legend26 = legendPTSbonus(26, ctx.saveData);
    const legendMulti = 1 + legend26 / 100;
    const comp51 =
      ctx.saveData.companionIds && ctx.saveData.companionIds.has(51)
        ? companionBonus(51)
        : 0;

    const ola262 = Number((optionsListData as any)?.[262]) || 0;
    const owlMF = (t: number): number =>
      ola262 > t ? (t === 9 ? ola262 - 9 : 1) : 0;
    const mf1 = 100 * owlMF(1);
    const mf3 = 100 * owlMF(3);
    const mf5 = 100 * owlMF(5);
    const mf7 = 100 * owlMF(7);
    const mf9a = 100 * Math.min(1, owlMF(9));
    const mf9b = 50 * Math.max(0, owlMF(9) - 1);
    const owlAll = mf1 + mf3 + mf5 + mf7 + mf9a + mf9b;
    const mfChildren: CorganNode[] = [];
    if (mf1 > 0) mfChildren.push(node("Feather 1", mf1, null, { fmt: "raw" }));
    if (mf3 > 0) mfChildren.push(node("Feather 3", mf3, null, { fmt: "raw" }));
    if (mf5 > 0) mfChildren.push(node("Feather 5", mf5, null, { fmt: "raw" }));
    if (mf7 > 0) mfChildren.push(node("Feather 7", mf7, null, { fmt: "raw" }));
    if (mf9a > 0) mfChildren.push(node("Feather 9", mf9a, null, { fmt: "raw" }));
    if (mf9b > 0)
      mfChildren.push(node("Feather 9+ (×50 ea)", mf9b, null, { fmt: "raw" }));

    const val = base * legendMulti * (1 + comp51) * (1 + owlAll / 100) * rawCount;
    return node(
      "Summoning Owl",
      val,
      [
        node("Base Per Owl", base, null, {
          fmt: "raw",
          note: "OWL_BASE[" + id + "]",
        }),
        node("Owl Count", rawCount, null, {
          fmt: "raw",
          note: "OLA[255]=" + ola255,
        }),
        node("Furry Friends Forever (Legend 26)", legendMulti, null, {
          fmt: "x",
          note: "legend 26",
        }),
        node(label("Companion", 51), 1 + comp51, null, {
          fmt: "x",
          note: "companion 51",
        }),
        node(
          "Megafeather Bonus",
          1 + owlAll / 100,
          mfChildren.length ? mfChildren : null,
          { fmt: "x", note: "OLA[262]=" + ola262 }
        ),
      ],
      { fmt: "+", note: "owl " + id }
    );
  },
};

export function computeOwlBonus(idx: number, saveData: SaveData): number {
  const owlLv = Number((saveData as any).owlData?.[idx]) || 0;
  if (owlLv <= 0) return 0;
  const base = Number(OWL_BASE[idx]) || 1;
  return base * owlLv;
}
