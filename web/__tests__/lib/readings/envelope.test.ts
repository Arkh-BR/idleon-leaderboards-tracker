import { describe, it, expect } from "vitest";
import { assertEnvelope, stripEnvelope } from "@/lib/readings/envelope";

const env = { data: { a: 1 }, charNames: ["x"], lastUpdated: 1 };

describe("reading envelope allowlist", () => {
  it("strip keeps the SaveEnvelope keys and drops everything else", () => {
    const out = stripEnvelope({ ...env, refreshToken: "r", "gameAuth.session.v1": "s", toString: 1 });
    expect(out).toEqual(env);
  });

  it("assert passes a clean envelope and names the extra keys otherwise", () => {
    expect(() => assertEnvelope(env)).not.toThrow();
    expect(() => assertEnvelope({ ...env, refreshToken: "r" })).toThrow(/outside the save envelope: refreshToken/);
    expect(() => assertEnvelope("nope")).toThrow(/not an object/);
    expect(() => assertEnvelope(null)).toThrow(/not an object/);
  });
});
