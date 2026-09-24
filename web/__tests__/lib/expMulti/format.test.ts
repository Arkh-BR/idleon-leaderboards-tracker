import { describe, it, expect } from "vitest";
import { formatExpMulti } from "@/lib/expMulti/format";

// N.js ActorEvents_29._event_PlayerInfo (@6665695): the "Class EXP:" line.
describe("formatExpMulti (the stats panel's Class EXP line)", () => {
  it.each([
    [1.4504214791708842e19, "14504214T"],
    [3.4e15, "3400T"],
    [3.405e14, "340.5T"],
    [3.4059e13, "34.05T"],
    [2.5e9, "2500M"],
    [2.503e8, "250.3M"],
    [2.5039e7, "25.03M"],
    [123456.9, "123456"],
    [5, "5.00"],
    [5.5, "5.50"],
    [12.3049, "12.3"],
    [12.346, "12.35"],
    // 12.345's own binary64 value is 12.34500000000000063949…, and ×100 lands
    // on exactly 1234.5 (verified via exact rational decomposition of the
    // double, no float dust either side) — Math.round ties away from zero,
    // so this prints "12.35", same as 12.346. Matches N.js round(100*v)/100
    // (SP/exp/semantics.md §2); the game does the same binary64 math.
    [12.345, "12.35"],
  ])("%s → %s", (v, s) => expect(formatExpMulti(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatExpMulti(NaN)).toBe("—"));
});
