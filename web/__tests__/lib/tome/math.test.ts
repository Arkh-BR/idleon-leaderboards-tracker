import { describe, it, expect } from "vitest";
import { TOME_BONUSES } from "@/lib/tome/tasks";
import { calcPointsPercent, maxPtsForBonus, quantityForPts } from "@/lib/tome/math";

// TomePTS = ceil(TomePCT x Tome[3]), 0 for a curve that went negative or non-finite
const ptsAt = (b: readonly [number, number, number], q: number) => {
  const pct = calcPointsPercent(b, q);
  return isFinite(pct) && pct > 0 ? Math.ceil(pct * b[2]) : 0;
};

describe("Tome curve helpers", () => {
  it("maxPtsForBonus is TomePTS at the top of each curve", () => {
    expect(maxPtsForBonus([10000, 0, 1000])).toBe(1450); // ceil(1.7^0.7 · 1000)
    expect(maxPtsForBonus([25, 1, 500])).toBe(600); // ceil(1.2 · 500)
    expect(maxPtsForBonus([1344, 2, 1000])).toBe(1000);
    expect(maxPtsForBonus([30, 3, 350])).toBe(403); // q = 0: (7.2/7)^5
    expect(maxPtsForBonus([1000000, 4, 1750])).toBe(1750);
  });

  it("quantityForPts lands on the first quantity the game scores at the target", () => {
    TOME_BONUSES.forEach((b, ci) => {
      const max = maxPtsForBonus(b);
      expect(quantityForPts(b, max + 1), `ci ${ci}`).toBeNull();
      for (const t of [1, Math.ceil(max / 2), max]) {
        const q = quantityForPts(b, t);
        if (q === null) continue; // past what a double can hold (log curve near 1.2)
        expect(ptsAt(b, q), `ci ${ci} t ${t}`).toBeGreaterThanOrEqual(t);
        const out = b[1] === 3 ? q + 1 : q - 1; // one step past the edge
        if (q > 0 && q < 2 ** 53) expect(ptsAt(b, out), `ci ${ci} t ${t}`).toBeLessThan(t);
      }
    });
  });
});
