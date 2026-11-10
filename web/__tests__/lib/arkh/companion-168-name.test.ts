import { describe, it, expect } from "vitest";
import { label } from "@/lib/arkh/stats/entity-names";
import { classifySystem } from "@/lib/arkh/stats/categorize";
import { compMulti } from "@/lib/arkh/stats/systems/common/companions";

// Companion 168 = "caveD" in CompanionDB (1.30x Drop Rate). Unnamed, it
// rendered "Companion 168" and — lacking the "(Companion" tag the categorizer
// keys on — fell into the "Other" bucket instead of 🐾 Companions. The name now
// comes from the game data (MONSTERS.caveD.Name) via gen-entity-names.ts.
describe("Companion 168 (Crystal Glunko) naming + categorization", () => {
  it("has a friendly name", () => {
    expect(label("Companion", 168)).toBe("Crystal Glunko (Companion 168)");
  });

  it("classifies under Companions, not Other", () => {
    expect(classifySystem(label("Companion", 168))).toBe("Companions");
  });

  it("does not regress another named companion", () => {
    expect(classifySystem(label("Companion", 49))).toBe("Companions");
  });
});

// Restored from the deleted frankenstein-infinity test: an uncapped companion must not emit a "Cap" ×-child (Infinity would poison PROD).
describe("compMulti: uncapped cap emits no Cap ×-child", () => {
  const ctx = { saveData: { companionIds: new Set([168]) } } as never;
  it("Crystal Glunko (168, uncapped) → Result 1.3, no Cap child", () => {
    const n = compMulti.resolve(168, ctx, [Infinity, 1, 0.3]);
    expect(n.val).toBeCloseTo(1.3, 6);
    expect((n.children || []).some((c) => c.name === "Cap")).toBe(false);
    expect((n.children || []).some((c) => c.name === "Result")).toBe(true);
  });
  it("a finite cap still shows the Cap child", () => {
    const n = compMulti.resolve(168, ctx, [1.3]);
    expect((n.children || []).some((c) => c.name === "Cap")).toBe(true);
  });
});
