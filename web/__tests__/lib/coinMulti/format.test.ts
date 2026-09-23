import { describe, it, expect } from "vitest";
import { formatCoinMulti, notateBig, notateMultiplierInfo } from "@/lib/coinMulti/format";

describe("formatCoinMulti — the game's MonsterCash stat line", () => {
  it.each([
    [6.773746899414287e35, "6.77E35"], // Markhe, map 14 (IdleonToolbox value)
    [5e16, "50Q"], // Big ladder, ceil
    [3.5e11, "350B"], // ⌊x/1e8⌋/10 + "B" (truncates)
    [12345678, "12.3M"], // ⌊x/1e5⌋/10 + "M" (truncates)
    [1234567, "1.23M"], // MultiplierInfo M form
    [1234.5, "1234.50"],
    [5, "5.00"],
    [2.34, "2.34"],
  ])("%s → %s", (x, shown) => expect(formatCoinMulti(x)).toBe(shown));

  it("keeps the game's getLOG quirk at exact powers of ten", () => {
    // getLOG = ln/2.30259 lands just under 22 for 1e22, so the game prints 10E21.
    expect(notateBig(1e22)).toBe("10E21");
  });

  it("MultiplierInfo pads to two decimals", () => {
    expect(notateMultiplierInfo(1.5)).toBe("1.50");
    expect(notateMultiplierInfo(2_000_000)).toBe("2.00M");
  });

  it("non-finite reads as a dash", () => expect(formatCoinMulti(NaN)).toBe("—"));
});
