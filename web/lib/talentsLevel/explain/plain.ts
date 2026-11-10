// The /talents-level tree of a talent with no wrap and no cap booster, read from lib/game's blocks. The rows under it are lib/dropRate/explain/talent's (the Drop Rate V1 page shows the same ones); only the
// root's shape is this page's: the same names, order, formats and notes as the page has always had, because the Hypothetical tab compares by path (lib/talentsLevel/topTalents.ts).
import { asNumber } from "@/lib/game/attr";
import type { Ctx } from "@/lib/game/ctx";
import { hString } from "@/lib/game/hstring";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetTalentNumber, talentCurveAt, talentCurves } from "@/lib/game/njs/GetTalentNumber";
import { skillLevel } from "@/lib/game/player";
import type { ArkhNode } from "@/lib/dropRate/node";
import { talentLevelRows, type TalentRowsOpts } from "@/lib/dropRate/explain/talent";
import { isAccountWideTalent } from "../accountWideTalents";
import { label } from "../entityNames";

/** The talent's first curve `[x1, x2, formula]`; null when it has none (an id the game has no description for, or a text-only talent). */
export function curveOf(id: number): readonly [number, number, string] | null {
  try {
    const [x1, x2, formula] = talentCurves(id);
    const name = hString(formula);
    return "txt" === name || "_" === name ? null : [asNumber(x1), asNumber(x2), name];
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
}

/** `split: false`: the super levels are a term of the Bonus Levels (the shape a talent has inside a cap booster's row), not a row of their own. */
export type PlainOpts = Pick<TalentRowsOpts, "forceSuper" | "capOf"> & { split?: boolean };

/** The talents the page reads as the best character's (N.js `getbonus2(1, id, -1)`): the account-wide ones, but 328 and 655 (the Workbench and the skull talent), whose rows have a shape of their own. */
const bestOf = (id: number): boolean => isAccountWideTalent(id) && 328 !== id && 655 !== id;

/** `Talent <id>`: Active and Effective Level (Base Level, Bonus Levels, Super Levels), or Level and Max Level for a star talent; the best character's chain under a Reference Character for an account-wide one. */
export function plainTalent(c: Ctx, id: number, o: PlainOpts = {}): ArkhNode {
  const name = label("Talent", id);
  const curve = curveOf(id);
  if (!curve) return { name, val: 0, note: "no formula data" };
  const rows = talentLevelRows(c, id, { ...o, split: o.split ?? true, best: bestOf(id) });
  const [x1, x2, formula] = curve;
  if (bestOf(id)) {
    const effective = rows.find((r) => r.name === "Effective Level");
    const val = o.forceSuper ? (effective ? talentCurveAt(c, 1, id, effective.val) : 0) : getbonus2(c, 1, id, -1);
    return { name, val, fmt: "+", children: rows };
  }
  const level = skillLevel(c, id);
  const effective = rows.find((r) => r.name === "Effective Level")?.val ?? level; // a star talent has none: its level is its points
  const val = 0 >= level ? 0 : o.forceSuper ? talentCurveAt(c, 1, id, effective) : GetTalentNumber(c, 1, id);
  return { name, val, fmt: "+", note: `${formula}(${x1},${x2},${effective})`, children: rows };
}
