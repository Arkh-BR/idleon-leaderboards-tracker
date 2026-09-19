import { describe, it, expect } from "vitest";

import { etagChanged } from "../../scripts/updater/check-njs-changed";
import { buildDiscordMessage } from "../../scripts/updater/ci/notify-discord";
import { normalizeEtag } from "../../scripts/updater/fetch-njs";

describe("etagChanged", () => {
  it("treats a missing baseline as changed (forces a seeding run)", () => {
    expect(etagChanged(null, '"abc"')).toBe(true);
    expect(etagChanged(undefined, '"abc"')).toBe(true);
  });
  it("is unchanged when baseline equals live", () => {
    expect(etagChanged('"abc"', '"abc"')).toBe(false);
  });
  it("is changed when the live etag differs", () => {
    expect(etagChanged('"abc"', '"def"')).toBe(true);
  });
  it("weak vs strong for the same content is NOT a change", () => {
    expect(etagChanged('"abc"', 'W/"abc"')).toBe(false);
  });
  // GitHub Pages ETag = "<mtime hex>-<size hex>"; replicas differ by a second.
  it("replica mtime skew with the same size is NOT a change (2026-09-18 false PR)", () => {
    expect(etagChanged('W/"6aad6d41-18f8a15"', 'W/"6aad6d42-18f8a15"')).toBe(false);
    expect(etagChanged('"6aad6d42-18f8a15"', 'W/"6aad6d41-18f8a15"')).toBe(false);
  });
  it("same size but a deploy more than five minutes apart IS a change", () => {
    expect(etagChanged('"6aad6d41-18f8a15"', '"6aad6e6e-18f8a15"')).toBe(true); // +301 s
  });
  it("a different size IS a change even with close mtimes", () => {
    expect(etagChanged('"6aad6d41-18f8a15"', '"6aad6d42-18f8a16"')).toBe(true);
  });
  it("a missing live etag still counts as changed", () => {
    expect(etagChanged('"6aad6d41-18f8a15"', null)).toBe(true);
  });
});

describe("buildDiscordMessage", () => {
  it("clean status mentions merge as the next step", () => {
    const m = buildDiscordMessage("https://gh/pr/1", "clean", "8754fec3");
    expect(m).toContain("🟢");
    expect(m).toContain("8754fec3");
    expect(m).toContain("mergear");
  });
  it("needs-human status points at the runbook", () => {
    const m = buildDiscordMessage("https://gh/pr/1", "needs-human", "8754fec3");
    expect(m).toContain("🟠");
    expect(m).toContain("runbook");
  });
});

describe("normalizeEtag", () => {
  it("strips weak W/ prefix", () => {
    expect(normalizeEtag('W/"6a3988cb-1870ac9"')).toBe('"6a3988cb-1870ac9"');
  });
  it("leaves a strong etag unchanged", () => {
    expect(normalizeEtag('"6a3988cb-1870ac9"')).toBe('"6a3988cb-1870ac9"');
  });
  it("returns null for null input", () => {
    expect(normalizeEtag(null)).toBe(null);
  });
});
