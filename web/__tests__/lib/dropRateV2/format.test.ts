import { describe, it, expect } from "vitest";
import { formatDropRateV2 } from "@/lib/dropRateV2/format";

// The character panel's Drop_Rate line (N.js PlayerInfo, "this._dummynumber3 =
// TotalStats("Drop_Rarity")" @6713518): above 9999 the integer part, else the
// MultiplierInfo-like ladder keyed on 10·d % 10 and 100·d % 10.
describe("formatDropRateV2 (the character panel's Drop Rate line)", () => {
  it("prints Math.floor above 9999 — no suffix ladder, no rounding", () => {
    expect(formatDropRateV2(10000)).toBe("10000");
    expect(formatDropRateV2(12345.99)).toBe("12345");
    expect(formatDropRateV2(5078093.91705)).toBe("5078093");
    expect(formatDropRateV2(1.2e12)).toBe("1200000000000");
    // strictly above: 9999.5 is over the cut, so it floors to 9999
    expect(formatDropRateV2(9999.5)).toBe("9999");
  });

  it("keeps two decimals at or below 9999", () => {
    expect(formatDropRateV2(9999)).toBe("9999.00");
    expect(formatDropRateV2(9998.994)).toBe("9998.99");
    expect(formatDropRateV2(5)).toBe("5.00");
    expect(formatDropRateV2(1.5)).toBe("1.50");
    expect(formatDropRateV2(2.25)).toBe("2.25");
    expect(formatDropRateV2(523.456)).toBe("523.46");
  });

  it("follows the game's unrounded tests: 5.004 is neither x.00 nor x.x0", () => {
    // 10·d % 10 = 0.04 and 100·d % 10 = 0.4 are both non-zero → Math.round(100d)/100 = 5
    expect(formatDropRateV2(5.004)).toBe("5");
  });

  it("is a dash when the number isn't finite", () => {
    expect(formatDropRateV2(NaN)).toBe("—");
    expect(formatDropRateV2(Infinity)).toBe("—");
  });
});
