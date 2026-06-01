import { describe, it, expect } from "vitest";
import { formatIdleon, formatPct, formatRelativeTime } from "@/lib/format";

describe("formatIdleon", () => {
  it("returns '—' for null, undefined, and non-finite values", () => {
    expect(formatIdleon(null)).toBe("—");
    expect(formatIdleon(undefined)).toBe("—");
    expect(formatIdleon(Infinity)).toBe("—");
    expect(formatIdleon(-Infinity)).toBe("—");
    expect(formatIdleon(NaN)).toBe("—");
  });

  it("formats whole numbers below 1M with locale", () => {
    expect(formatIdleon(0)).toBe("0");
    expect(formatIdleon(999)).toBe("999");
    expect(formatIdleon(1_000)).toBe("1,000");
    expect(formatIdleon(999_999)).toBe("999,999");
    expect(formatIdleon(1_234_567)).not.toBe("1,234,567"); // crosses into M
  });

  it("formats millions with M suffix", () => {
    expect(formatIdleon(1_000_000)).toBe("1.00M");
    expect(formatIdleon(5_500_000)).toBe("5.50M");
    expect(formatIdleon(999_999_999)).toBe("1000.00M");
  });

  it("formats billions with B suffix", () => {
    expect(formatIdleon(1_000_000_000)).toBe("1.00B");
    expect(formatIdleon(2_500_000_000)).toBe("2.50B");
    expect(formatIdleon(999_999_999_999)).toBe("1000.00B");
  });

  it("formats trillions with T suffix", () => {
    expect(formatIdleon(1_000_000_000_000)).toBe("1.00T");
    expect(formatIdleon(7_777_000_000_000)).toBe("7.78T");
  });

  it("formats quadrillions with Q suffix", () => {
    expect(formatIdleon(1e15)).toBe("1.00Q");
    expect(formatIdleon(1e18)).toBe("1.00QQ");
    expect(formatIdleon(1e21)).toBe("1.00QQQ");
  });

  it("uses exponential notation beyond QQQ", () => {
    expect(formatIdleon(1e24)).toBe("1.00e+24");
    expect(formatIdleon(1e30)).toBe("1.00e+30");
  });

  it("respects custom decimals", () => {
    expect(formatIdleon(1_500_000, 0)).toBe("2M");
    expect(formatIdleon(1_500_000, 1)).toBe("1.5M");
    expect(formatIdleon(1_500_000, 3)).toBe("1.500M");
  });

  it("handles negative numbers", () => {
    expect(formatIdleon(-1_000_000)).toBe("-1.00M");
  });
});

describe("formatPct", () => {
  it("returns '—' for null or zero denominator", () => {
    expect(formatPct(null, 100)).toBe("—");
    expect(formatPct(50, null)).toBe("—");
    expect(formatPct(50, 0)).toBe("—");
    expect(formatPct(null, null)).toBe("—");
  });

  it("returns '—' for non-finite values", () => {
    expect(formatPct(Infinity, 100)).toBe("—");
    expect(formatPct(100, NaN)).toBe("—");
  });

  it("calculates percentage correctly", () => {
    expect(formatPct(50, 100)).toBe("50.00%");
    expect(formatPct(1, 3)).toBe("33.33%");
    expect(formatPct(0, 100)).toBe("0.00%");
    expect(formatPct(100, 100)).toBe("100.00%");
  });
});

describe("formatRelativeTime", () => {
  it("formats seconds-ago strings", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5_000)).toBe("5s ago");
    expect(formatRelativeTime(now - 59_000)).toBe("59s ago");
  });

  it("formats minutes-ago strings", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60_000)).toBe("1min ago");
    expect(formatRelativeTime(now - 59 * 60_000)).toBe("59min ago");
    // 60 min rounds to 1h
    expect(formatRelativeTime(now - 3_600_000)).toBe("1h ago");
  });

  it("formats hours-ago strings", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3_660_000)).toBe("1h ago");
    // 24h rounds to 1d
    expect(formatRelativeTime(now - 86_400_000)).toBe("1d ago");
  });

  it("formats days-ago strings", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 86_400_001)).toBe("1d ago");
  });
});
