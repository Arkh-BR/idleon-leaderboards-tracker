// CI smoke test — no private save required. Runs a maximally-empty envelope
// through every Coin Multi source so a broken/renamed source id (the coin
// switch throws on unknown ids) or a crash on missing save fields fails CI,
// not just the local-only save-gated tests.
import { describe, it, expect } from "vitest";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("Coin Multi smoke test", () => {
  it("computes every source on an empty save without throwing", () => {
    const { tree, total } = computeArkhCoinMulti({ charNames: ["A"], data: {} }, 0, 301);
    expect(total).toBe(1);
    expect(tree.children).toHaveLength(23);
    expect(tree.children).toHaveLength(COIN_GROUPS.length);
  });
});
