import { describe, it, expect, vi } from "vitest";

// Stub out headNjs so the module-level main() in check-njs-changed.ts does not
// fire a real network request when vitest imports the module.
vi.mock("../../scripts/updater/fetch-njs", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../scripts/updater/fetch-njs")>();
  return { ...real, headNjs: vi.fn().mockResolvedValue({ etag: null, lastModified: null, byteLength: null }) };
});

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
