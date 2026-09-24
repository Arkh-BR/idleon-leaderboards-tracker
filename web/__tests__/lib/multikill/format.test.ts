import { describe, it, expect } from "vitest";
import { formatMultikill } from "@/lib/multikill/format";

// N.js @3835457: "MULTIKILL;_" + Math.floor(MK) + "%" — no thousands separator.
describe("formatMultikill (the AFK Info's MULTIKILL line)", () => {
  it.each<[number, string]>([
    [81706, "81706"],
    [81706.99, "81706"],
    [3185, "3185"],
    [626, "626"],
    [0, "0"],
  ])("%s → %s", (v, s) => expect(formatMultikill(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatMultikill(NaN)).toBe("—"));
});
