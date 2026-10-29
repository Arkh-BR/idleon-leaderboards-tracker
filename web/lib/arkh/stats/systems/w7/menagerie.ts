// ===== LUMINOUS MENAGERIE SYSTEM (W7, 2026-10-16) — DR slice =====
// Boost 24 ("}x_Drop_Rate") joins the Drop_Rarity multiplier chain:
//   …*(1+RoyalG("StatueBon",1)/100)*(1+MenagerieStuff("BoostQTY",24)/100)*(1+CardBonusREAL(101)/100)…
import { node, type ArkhNode } from "../../../node";
import {
  MENAGERIE_BOOST_PER_LV,
  menagerieBoostLv,
  menagerieBoostName,
  menagerieBoostQTY,
} from "../../data/w7/menagerie";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

/** Menagerie Boost b as a % (the descriptor applies it as ×(1 + v/100)). */
export const menagerieBoost = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const s = ctx.saveData;
    const lv = menagerieBoostLv(id, s);
    return node(
      `Menagerie Boost: ${menagerieBoostName(id)} (Boost ${id})`,
      menagerieBoostQTY(id, s),
      [
        node("Level", lv, null, { fmt: "raw" }),
        node("Per Level", MENAGERIE_BOOST_PER_LV[id] || 0, null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "menagerie boost " + id }
    );
  },
};
