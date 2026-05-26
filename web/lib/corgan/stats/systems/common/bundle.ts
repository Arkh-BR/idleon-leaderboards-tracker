// ===== BUNDLE SYSTEM =====
// Returns the bundle's flat DR contribution: bun_v adds +2, bun_p adds +1.2x
// (raw multiplier — descriptor combine() uses item.fmt to know).
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

// Bundle product names — the IT website-data `bundles` map only carries
// marketing copy + price, no display name. The community refers to these
// by their gem-shop product names, so we hard-code those:
//   bun_v → Death Bringer Bundle (+2 flat DR, Drop Rate Pack)
//   bun_p → Explorer Bundle      (×1.2 multi, Multiplicative Drop Rate Pack)
const BUNDLE_DATA: Record<
  string,
  { add: number; fmt: "+" | "x"; name: string }
> = {
  bun_v: { add: 2, fmt: "+", name: "Death Bringer Bundle" },
  bun_p: { add: 1.2, fmt: "x", name: "Explorer Bundle" },
};
function bundleLabel(id: string): string {
  const d = BUNDLE_DATA[id];
  return d ? `${d.name} (Bundle ${id})` : bundleLabel(id);
}

export const bundle = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const data = BUNDLE_DATA[id];
    if (!data)
      return node(bundleLabel(id), 0, null, { note: "bundle " + id });
    const owned =
      Number((ctx.saveData.bundlesData as any)?.[id]) === 1;
    if (!owned) {
      const idle = data.fmt === "x" ? 1 : 0;
      return node(
        bundleLabel(id),
        idle,
        [node("Not owned", 0, null, { fmt: "raw" })],
        { fmt: data.fmt, note: "bundle " + id }
      );
    }
    return node(
      bundleLabel(id),
      data.add,
      [node("Owned", 1, null, { fmt: "raw" })],
      { fmt: data.fmt, note: "bundle " + id }
    );
  },
};
