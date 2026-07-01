import { describe, it, expect } from "vitest";
import { deepViewAccentClasses } from "@/components/dropRate/DeepView";

describe("deepViewAccentClasses", () => {
  it("defaults every caller to the existing sky classes (no visual change for Drop Rate/Talents)", () => {
    const c = deepViewAccentClasses("sky");
    expect(c.tabActive).toContain("bg-sky-500/15");
    expect(c.tabActive).toContain("text-sky-300");
    expect(c.focusBorder).toBe("focus:border-sky-500/60");
    expect(c.checkbox).toBe("accent-sky-500");
  });

  it("provides an emerald variant for the Cooking page", () => {
    const c = deepViewAccentClasses("emerald");
    expect(c.tabActive).toContain("bg-emerald-500/15");
    expect(c.tabActive).toContain("text-emerald-300");
    expect(c.focusBorder).toBe("focus:border-emerald-500/60");
    expect(c.checkbox).toBe("accent-emerald-500");
  });
});
