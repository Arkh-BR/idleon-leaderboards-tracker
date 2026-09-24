// CI smoke test — no private save. Every EXP source must resolve on an empty
// envelope (the exp switch throws on unknown ids).
import { describe, it, expect } from "vitest";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";

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
