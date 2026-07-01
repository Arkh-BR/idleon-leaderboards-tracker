import { describe, it, expect } from "vitest";
import { notate } from "@/components/cookingMastery/MasteryOptimizer";

describe("notate", () => {
  it("keeps a visible significant figure for tiny deltas instead of rounding to 0.00", () => {
    expect(notate(0.003)).not.toBe("0.00");
    expect(notate(0.003)).not.toBe("0");
    expect(notate(0.003)).toContain("3");
  });

  it("still renders whole numbers and large values exactly as before", () => {
    expect(notate(0)).toBe("0");
    expect(notate(3)).toBe("3");
    expect(notate(4.567)).toBe("4.57");
    expect(notate(12_345)).toBe("12.35K");
  });
});
