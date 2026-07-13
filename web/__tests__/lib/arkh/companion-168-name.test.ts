import { describe, it, expect } from "vitest";
import { label } from "@/lib/arkh/stats/entity-names";
import { classifySystem } from "@/lib/arkh/stats/categorize";

// Companion 168 = "caveD" in CompanionDB (1.30x Drop Rate). IT's website-data
// never named it, so it rendered "Companion 168" and — lacking the "(Companion"
// tag the categorizer keys on — fell into the "Other" bucket instead of 🐾
// Companions. A manual name in entity-names fixes both.
describe("Companion 168 (Crystal Glunko) naming + categorization", () => {
  it("has a friendly name despite IT data lacking one", () => {
    expect(label("Companion", 168)).toBe("Crystal Glunko (Companion 168)");
  });

  it("classifies under Companions, not Other", () => {
    expect(classifySystem(label("Companion", 168))).toBe("Companions");
  });

  it("does not regress an IT-named companion", () => {
    expect(classifySystem(label("Companion", 49))).toBe("Companions");
  });
});
