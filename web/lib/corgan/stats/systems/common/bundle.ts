// ===== BUNDLE SYSTEM =====
// Returns the bundle's flat DR contribution: bun_v adds +2, bun_p adds +1.2x
// (raw multiplier — descriptor combine() uses item.fmt to know).
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const BUNDLE_DATA: Record<
  string,
  { add: number; fmt: "+" | "x" }
> = {
  bun_v: { add: 2, fmt: "+" },
  bun_p: { add: 1.2, fmt: "x" },
};

export const bundle = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const data = BUNDLE_DATA[id];
    if (!data)
      return node(label("Bundle", id), 0, null, { note: "bundle " + id });
    const owned =
      Number((ctx.saveData.bundlesData as any)?.[id]) === 1;
    if (!owned) {
      const idle = data.fmt === "x" ? 1 : 0;
      return node(
        label("Bundle", id),
        idle,
        [node("Not owned", 0, null, { fmt: "raw" })],
        { fmt: data.fmt, note: "bundle " + id }
      );
    }
    return node(
      label("Bundle", id),
      data.add,
      [node("Owned", 1, null, { fmt: "raw" })],
      { fmt: data.fmt, note: "bundle " + id }
    );
  },
};
