import { describe, it, expect } from "vitest";
import { formatNum, numParts } from "@/lib/numberFormat";

// Site-wide number format: always 3 decimals, K/M/B/T/Q/QQ/QQQ then
// E-notation past 1e24. Values below chosen to avoid float half-ties (see
// brief) so the expected strings are unambiguous.

describe("formatNum", () => {
  it.each([
    [0, "0.000"],
    [1.26974, "1.270"],
    [999.9994, "999.999"],
    [999.9996, "1.000K"], // rounding promotes past the plain range
    [1000, "1.000K"],
    [20696.661, "20.697K"],
    [363893.46, "363.893K"],
    [999999.9999, "1.000M"], // rounding promotes past K
    [171140496624.184, "171.140B"],
    [17114049124784.227, "17.114T"],
    [5e18, "5.000QQ"],
    [7e21, "7.000QQQ"],
    [6.885265702671293e35, "6.885E35"],
    [9.9996e24, "1.000E25"], // mantissa rounds to 10.000 → bump the exponent
    [-1234, "-1.234K"],
  ])("formatNum(%p) -> %p", (input, expected) => {
    expect(formatNum(input)).toBe(expected);
  });

  it("adds a leading + for v >= 0 and appends the unit after the suffix", () => {
    expect(formatNum(1234, { plus: true, unit: "%" })).toBe("+1.234K%");
    expect(formatNum(75, { plus: true, unit: "%" })).toBe("+75.000%");
  });

  it("never double-signs a negative value even when plus is requested", () => {
    expect(formatNum(-1234, { plus: true, unit: "%" })).toBe("-1.234K%");
  });

  it("non-finite values render as an em dash", () => {
    expect(formatNum(NaN)).toBe("—");
    expect(formatNum(Infinity)).toBe("—");
    expect(formatNum(-Infinity)).toBe("—");
  });
});

describe("numParts", () => {
  it("splits a value into sign / 3-decimal digits / suffix", () => {
    expect(numParts(171140496624.184)).toEqual({
      sign: "",
      num: "171.140",
      suffix: "B",
    });
  });

  it("returns a '-' sign for negatives", () => {
    expect(numParts(-1234)).toEqual({ sign: "-", num: "1.234", suffix: "K" });
  });

  it("returns null for non-finite input", () => {
    expect(numParts(NaN)).toBeNull();
    expect(numParts(Infinity)).toBeNull();
    expect(numParts(-Infinity)).toBeNull();
  });
});
