import { describe, it, expect } from "vitest";
import { resolveCompanionActiveIds } from "@/lib/arkh/save/loader";

// Pet-Bonus Token (Summer Event 2026): a companion's bonus can be active via
// a token WITHOUT owning the pet. The token activations live in a CSV in
// OptionsListAccount[606]. The engine treats "active" as owned OR token, with
// the identical bonus value — mirroring N.js DNSM.CompanionBon population.
describe("resolveCompanionActiveIds (Pet-Bonus Token)", () => {
  it("includes owned companions from the it.json envelope (id,...)", () => {
    const ids = resolveCompanionActiveIds(["12,foo", "30,bar"], "");
    expect(ids.has(12)).toBe(true);
    expect(ids.has(30)).toBe(true);
    expect(ids.has(168)).toBe(false);
  });

  it("includes a token-activated companion not owned (Crystal Glunko 168)", () => {
    const ids = resolveCompanionActiveIds([], "168");
    expect(ids.has(168)).toBe(true);
  });

  it("unions owned + token; token is a CSV of multiple IDs", () => {
    const ids = resolveCompanionActiveIds(["12,foo"], "168,30");
    expect([...ids].sort((a, b) => a - b)).toEqual([12, 30, 168]);
  });

  it("treats empty / missing token field as no token bonuses", () => {
    expect(resolveCompanionActiveIds(["12,x"], "").size).toBe(1);
    expect(resolveCompanionActiveIds(["12,x"], undefined).size).toBe(1);
    expect(resolveCompanionActiveIds(["12,x"], null).size).toBe(1);
  });

  it("applies the token even with no owned-companion list at all", () => {
    const ids = resolveCompanionActiveIds(undefined, "168");
    expect(ids.has(168)).toBe(true);
    expect(ids.size).toBe(1);
  });

  it("ignores non-numeric / blank token entries", () => {
    const ids = resolveCompanionActiveIds([], "168,,abc,30");
    expect([...ids].sort((a, b) => a - b)).toEqual([30, 168]);
  });

  it("accepts a numeric token value, not just a string", () => {
    const ids = resolveCompanionActiveIds([], 168 as unknown);
    expect(ids.has(168)).toBe(true);
  });
});
