import { describe, it, expect } from "vitest";
import { deriveGatedCoinTalents } from "@/scripts/_shared/coinClassGating";
import { allClassKeys } from "@/scripts/_shared/classGating";
import { COIN_CLASS_TALENTS } from "@/lib/arkh/stats/systems/coin/coin";

describe("coin class gating", () => {
  it("gates only coin talents that some — not all — classes have", () => {
    const all = allClassKeys().length;
    for (const g of deriveGatedCoinTalents()) {
      expect(COIN_CLASS_TALENTS as readonly number[]).toContain(g.id);
      expect(g.owners.size).toBeGreaterThan(0);
      expect(g.owners.size).toBeLessThan(all);
    }
  });
});
