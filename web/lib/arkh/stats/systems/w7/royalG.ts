// ===== ROYAL GUARDIAN SYSTEMS (W7, 2026-08) — Drop Rate slice =====
// Two new DR sources introduced with the Royal Guardian masterclass:
//   • Royal Statue #1 (DROP_RATE): ×(1 + StatueBon(1)/100) in the mult chain.
//   • Talent 239 "+{%_Drop_Rate_per_Resource_Grade": GetTalentNumber(1,239) ×
//     TotalStatz(0) added to the LUK2 additive group.
// Both read the `RoyalG` save attribute (see data/w7/royalG.ts).

import { node, type ArkhNode } from "../../../node";
import { entityName } from "../../entity-names";
import { talent } from "../common/talent";
import {
  armoryUpgBonus,
  royalStatueBon,
  royalStatueLv,
  royalStatueName,
  royalStatueParams,
  totalResourceGrade,
} from "../../data/w7/royalG";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number; [k: string]: unknown };

/** Royal Statue bonus as a % (the descriptor applies it as ×(1 + v/100)). */
export const royalStatue = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const s = ctx.saveData;
    const lv = royalStatueLv(id, s);
    const val = royalStatueBon(id, s);
    const name = `Royal Statue: ${royalStatueName(id)}`;
    const { base, perLv } = royalStatueParams(id);
    if (lv <= 0) {
      return node(
        name,
        0,
        [node("Level", 0, null, { fmt: "raw", note: "not built" })],
        { fmt: "+", note: "royal statue " + id }
      );
    }
    return node(
      name,
      val,
      [
        node("Level", lv, null, { fmt: "raw" }),
        node("Base", base, null, { fmt: "raw" }),
        node("Per Level", perLv, null, { fmt: "raw", note: "× (level − 1)" }),
        node("Royal Reverence (Armory 45)", armoryUpgBonus(45, s), null, {
          fmt: "+",
          note: "% boost to every Royal Statue",
        }),
      ],
      { fmt: "+", note: "royal statue " + id }
    );
  },
};

/** Talent × Σ resource-node Grades — an additive DR term. Named like every
 *  other talent row ("<name> … (Talent N)") so the categorizer files it under
 *  Talents; the Royal Guardian bucket keeps only the statue + family bonus. */
export const royalGrade = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const t = talent.resolve(id, ctx as any);
    const grades = totalResourceGrade(ctx.saveData);
    const perGrade = Number(t.val) || 0;
    const val = perGrade * grades;
    const talentName = entityName("Talent", id) || "DR per Resource Grade";
    return node(
      `${talentName} × Total Resource Grades (Talent ${id})`,
      val,
      [
        t,
        node("Total Resource Grades", grades, null, {
          fmt: "raw",
          note: "Σ RoyalG[5] — every resource node's Grade, all worlds",
        }),
      ],
      { fmt: "+", note: `talent ${id} × total resource grade` }
    );
  },
};
