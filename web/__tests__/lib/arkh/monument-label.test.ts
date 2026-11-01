import { describe, it, expect } from "vitest";
import { monumentBonusLabel } from "@/lib/arkh/stats/systems/w5/hole";

describe("monumentBonusLabel", () => {
  it("names the monument and its bonus the way the game does", () => {
    expect(monumentBonusLabel(1, 2)).toBe("Justice Monument: Artifact Find Chance");
    expect(monumentBonusLabel(1, 6)).toBe("Justice Monument: Class EXP Gain");
    expect(monumentBonusLabel(0, 0)).toBe("Bravery Monument: Mining Efficiency");
  });
});
