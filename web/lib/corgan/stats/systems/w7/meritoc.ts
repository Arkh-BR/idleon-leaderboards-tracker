// ===== MERITOC SYSTEM (W7) =====
// 1:1 port of corgan-source/js/stats/systems/w7/meritoc.js. Replaces the
// Stage 2/4 stub.

import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { MERITOC_BASE } from "../../data/w7/meritoc";
import { eventShopOwned } from "../../../game-helpers";
import { arcadeBonus } from "../w2/arcade";
import { legendPTSbonus } from "./spelunking";
import { companionBonus } from "../../data/common/companions";
import { rogBonusQTY } from "./sushi";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

type MeritocParts = {
  val: number;
  inactive?: boolean;
  noBase?: boolean;
  baseVal?: number;
  canVote?: boolean;
  multi?: number;
  clamWork3?: number;
  comp39?: number;
  legend24?: number;
  arcade59?: number;
  eventShop23?: number;
  rog51?: number;
  comp161?: number;
};

function _meritocParts(optionIdx: number, saveData: SaveData): MeritocParts {
  if (!saveData || !saveData.olaData) return { val: 0, inactive: true };
  const activeVote = Number((saveData.olaData as any)[453]) || 0;
  if (optionIdx !== activeVote) return { val: 0, inactive: true };
  const baseVal = MERITOC_BASE[optionIdx] || 0;
  if (baseVal <= 0) return { val: 0, noBase: true };
  const canVote = Number((saveData.olaData as any)[472]) === 1;
  const clamWork3 = (Number((saveData.olaData as any)[464]) || 0) > 3 ? 1 : 0;
  const comp39 =
    saveData.companionIds && saveData.companionIds.has(39)
      ? companionBonus(39)
      : 0;
  const legend24 = legendPTSbonus(24, saveData);
  const arcade59 = arcadeBonus(59, saveData).val;
  const eventShop23 = eventShopOwned(23, saveData.cachedEventShopStr);
  const rog51 = rogBonusQTY(51, saveData.cachedUniqueSushi);
  const comp161 =
    saveData.companionIds && saveData.companionIds.has(161)
      ? companionBonus(161)
      : 0;
  const addSum =
    5 * clamWork3 + comp39 + legend24 + arcade59 + 20 * eventShop23 + rog51;
  const multi = (canVote ? 1 : 0.25) + addSum / 100;
  const val = baseVal * (1 + comp161 / 100) * multi;
  return {
    val, baseVal, canVote, multi, clamWork3, comp39, legend24,
    arcade59, eventShop23, rog51, comp161,
  };
}

export function computeMeritocBonusz(
  optionIdx: number,
  saveData: SaveData
): number {
  return _meritocParts(optionIdx, saveData).val;
}

export const meritoc = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const p = _meritocParts(id, saveData);
    if (p.inactive)
      return node(label("Meritoc", id), 0, [node("Not active vote", 0)], {
        note: "meritoc " + id,
      });
    if (p.noBase)
      return node(label("Meritoc", id), 0, null, { note: "meritoc " + id });
    const multiCh: CorganNode[] = [];
    if (p.clamWork3)
      multiCh.push(
        node(
          "Coffee Brain (Clam Work 3)",
          5 * (p.clamWork3 || 0),
          null,
          { fmt: "raw" }
        )
      );
    if ((p.comp39 || 0) > 0)
      multiCh.push(
        node(label("Companion", 39), p.comp39 || 0, null, { fmt: "raw" })
      );
    if ((p.legend24 || 0) > 0)
      multiCh.push(
        node("Voter's Right (Legend 24)", p.legend24 || 0, null, { fmt: "raw" })
      );
    if ((p.arcade59 || 0) > 0)
      multiCh.push(
        node(label("Arcade", 59), p.arcade59 || 0, null, { fmt: "raw" })
      );
    if ((p.eventShop23 || 0) > 0)
      multiCh.push(
        node(label("Event", 23), 20 * (p.eventShop23 || 0), null, { fmt: "raw" })
      );
    if ((p.rog51 || 0) > 0)
      multiCh.push(node(label("RoG", 51), p.rog51 || 0, null, { fmt: "raw" }));
    const ch: CorganNode[] = [
      node("Base", p.baseVal || 0, null, { fmt: "raw" }),
      node(
        p.canVote ? "Can Vote" : "Cannot Vote",
        p.multi || 0,
        multiCh,
        { fmt: "x" }
      ),
    ];
    if ((p.comp161 || 0) > 0)
      ch.push(
        node(label("Companion", 161, " ×"), 1 + (p.comp161 || 0) / 100, null, {
          fmt: "x",
        })
      );
    return node(label("Meritoc", id), p.val, ch, {
      fmt: "+",
      note: "meritoc " + id,
    });
  },
};
