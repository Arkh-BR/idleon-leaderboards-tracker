import { describe, it, expect } from "vitest";
import { formatArtifactFind } from "@/lib/artifactFind/format";
import { notateBig, notateMultiplierInfo } from "@/lib/coinMulti/format";

// The Skill Info line for Sailing: NotateNumber "Big" above 1e4, else "MultiplierInfo".
describe("formatArtifactFind (the Skill Info's Artifact Find line)", () => {
  it("uses the Big ladder above 1e4", () => {
    expect(formatArtifactFind(12345.6)).toBe(notateBig(12345.6));
    expect(formatArtifactFind(1.1539e18)).toBe(notateBig(1.1539e18));
  });

  it("uses MultiplierInfo at or below 1e4", () => {
    expect(formatArtifactFind(523.4)).toBe(notateMultiplierInfo(523.4));
    expect(formatArtifactFind(1e4)).toBe(notateMultiplierInfo(1e4));
    expect(formatArtifactFind(5)).toBe("5.00");
  });
});
