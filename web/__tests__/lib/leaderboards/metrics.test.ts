import { describe, it, expect } from "vitest";
import { climbOne, gapToCutoff } from "@/lib/leaderboards/metrics";
import { formatMetric, formatGap } from "@/lib/leaderboards/format";
import { formatIdleon } from "@/lib/format";

describe("climbOne", () => {
  it("higher-is-better gap", () => {
    const c = climbOne({ r: 50, v: 22424, p: 1.8, t: 1, nr: 49, nv: 22459 }, false);
    expect(c).toMatchObject({ kind: "gap", delta: 35, toRank: 49 });
  });
  it("lower-is-better gap", () => {
    const c = climbOne({ r: 5, v: 12.4, p: 1, t: 1, nr: 4, nv: 12.0 }, true);
    expect(c.kind).toBe("gap");
    if (c.kind === "gap") {
      expect(c.delta).toBeCloseTo(0.4);
    }
  });
  it("top and tied-top", () => {
    expect(climbOne({ r: 1, v: 5, p: 0, t: 58 }, false)).toEqual({ kind: "tied-top", ties: 58 });
    expect(climbOne({ r: 1, v: 5, p: 0, t: 1 }, false)).toEqual({ kind: "top" });
  });
  it("unknown when neighbour missing", () => {
    expect(climbOne({ r: 5, v: 5, p: 0, t: 1 }, false)).toEqual({ kind: "unknown" });
  });
});

describe("gapToCutoff", () => {
  it("gap", () => {
    expect(gapToCutoff(9470, 140, 9880, 100, false)).toMatchObject({ kind: "gap", delta: 410 });
  });
  it("inside", () => expect(gapToCutoff(1, 80, 9880, 100, false)).toEqual({ kind: "inside" }));
  it("unknown", () => expect(gapToCutoff(1, 140, undefined, 100, false)).toEqual({ kind: "unknown" }));
  it("lower-is-better", () => {
    expect(gapToCutoff(12.4, 140, 12, 100, true)).toMatchObject({ kind: "gap" });
  });
});

describe("format", () => {
  it("formatMetric", () => {
    expect(formatMetric(4.6622, "multiplier")).toBe("4.6622x");
    expect(formatMetric(12.5, "multiplier")).toBe("12.50x");
    expect(formatMetric(289.5, "seconds")).toBe("12.4s");
    expect(formatMetric(3600, "seconds")).toBe("1.000s");
    expect(formatMetric(0, "seconds")).toBe("—");
    expect(formatMetric(22424, "default")).toBe(formatIdleon(22424));
    expect(formatMetric(22424, "bits")).toBe(formatIdleon(22424));
  });
  it("seconds under 1 s keep 3 significant digits (sproutSpeed's rates are in the millions)", () => {
    expect(formatMetric(10384949, "seconds")).toBe("0.000347s");
    expect(formatGap(2211636, 2300000, "seconds")).toBe("−0.0000625s");
    expect(formatMetric(3600 / 4.9999, "seconds")).toBe("5.000s");
    expect(formatMetric(3600 / 5, "seconds")).toBe("5.0s");
  });
  it("formatGap", () => {
    expect(formatGap(240, 300, "seconds")).toBe("−3.000s");
    expect(formatGap(22424, 22459, "default")).toBe("+35");
    expect(formatGap(4.5, 4.6622, "multiplier")).toBe("+0.1622x");
  });
});
