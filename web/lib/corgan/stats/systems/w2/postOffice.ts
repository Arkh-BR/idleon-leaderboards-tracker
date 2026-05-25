// ===== POST OFFICE SYSTEM (W2) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { postOfficeData } from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { postOfficeSlotParams } from "../../data/w2/postOffice";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

export const postOffice = {
  resolve(id: number | string | (number | string)[], ctx: Ctx): CorganNode {
    const key = Array.isArray(id) ? id.join(",") : String(id);
    const parts = key.split(",");
    const boxIdx = Number(parts[0]) || 0;
    const slotIdx = Number(parts[1]) || 0;
    const data = postOfficeSlotParams(boxIdx, slotIdx);
    const name = label("Post Office", boxIdx);
    if (!data)
      return node(name, 0, null, { note: "post office " + key });
    const points =
      Number(
        (postOfficeData as any)?.[ctx.charIdx]?.[boxIdx]
      ) || 0;
    if (points <= 0)
      return node(name, 0, null, { note: "post office " + key });
    const val = formulaEval(data.formula, data.x1, data.x2, points);
    return node(
      name,
      val,
      [
        node("Points Invested", points, null, { fmt: "raw" }),
        node("Formula Result", val, null, {
          fmt: "raw",
          note: data.formula + "(" + data.x1 + "," + data.x2 + "," + points + ")",
        }),
      ],
      { fmt: "+", note: "post office " + key }
    );
  },
};
