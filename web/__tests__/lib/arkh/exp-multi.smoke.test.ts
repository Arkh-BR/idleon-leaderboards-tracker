// CI smoke test — no private save. Every EXP source must resolve on an empty
// envelope (the exp switch throws on unknown ids).
import { describe, it, expect } from "vitest";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS, EXP_ROOT } from "@/lib/arkh/stats/defs/exp-multi";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("EXP Multi smoke test", () => {
  it("computes every source on an empty save without throwing", () => {
    const { tree, total } = computeArkhExpMulti({ charNames: ["A"], data: {} }, 0, 14);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(tree.children).toHaveLength(EXP_GROUPS.length);
    tree.children!.forEach((grp, i) => expect(grp.children).toHaveLength(EXP_GROUPS[i].sources.length));
  });

  // Every group's factor, recomputed by the Biggest Gains model purely from
  // the flattened tree (path string arithmetic), must reproduce the same
  // total the tree itself carries (built by combine() from the real pools).
  // A node whose name embeds " / " — the flat-tree path separator — would
  // fragment into fake sub-path segments and silently drop out of its
  // group's direct children (see the cardSet5 fix in systems/exp/exp.ts).
  it("groupedGainsModel.totalFromFlat(flattenTree(tree)) reproduces tree.val", () => {
    const { tree } = computeArkhExpMulti({ charNames: ["A"], data: {} }, 0, 14);
    const flat = flattenTree(tree);
    const total = groupedGainsModel(EXP_ROOT, EXP_GROUPS).totalFromFlat(flat);
    expect(Math.abs(total / tree.val - 1)).toBeLessThan(1e-12);
  });

  // The private save has no ClassEXP food equipped, so the port is checked
  // here: 2 food slots (no gem / merit), FoodPotYe1 (ClassEXP, Amount 30)
  // counts; FoodPotYe2 sits in slot 2, past FoodSlotsOwned.
  it("food sums the equipped ClassEXP foods within the owned slots", () => {
    const env = {
      charNames: ["A"],
      data: { EquipOrder_0: [[], [], ["FoodPotYe1", "Blank", "FoodPotYe2"]], EquipQTY_0: [[], [], [3, 0, 3]] },
    };
    const { tree } = computeArkhExpMulti(env, 0, 14);
    const gi = EXP_GROUPS.findIndex((x) => x.key === "g10");
    expect(tree.children![gi].children![EXP_GROUPS[gi].sources.indexOf("food")].val).toBe(30);
  });
});
