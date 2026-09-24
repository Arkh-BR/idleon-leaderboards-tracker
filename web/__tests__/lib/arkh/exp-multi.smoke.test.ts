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
});
