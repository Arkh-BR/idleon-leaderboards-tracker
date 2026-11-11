import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProfileSave, gatherCandidates, readProfileSave, savedPlayers } from "../../scripts/_shared/itProfiles";
import { safeName } from "../../scripts/fetch-top-profiles";
import { CATEGORIES } from "../../lib/registry";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe("fetchProfileSave", () => {
  it("sends our site's Origin and User-Agent, and no Idleon Toolbox Referer (agreed with the owner, 2026-11-11)", async () => {
    const fetch = vi.fn(async () => json({ data: {}, charNames: ["a"] }));
    vi.stubGlobal("fetch", fetch);
    await fetchProfileSave("Someone");
    const headers = (fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers.Origin).toBe("https://arkh-idleon-trackers.vercel.app");
    expect(headers["User-Agent"]).toMatch(/IdleonTrackersScraper\/1\.0/);
    expect(headers.Referer).toBeUndefined();
  });

  it("a refused request gives null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: "Forbidden" }) }) as unknown as Response));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchProfileSave("Someone")).toBeNull();
  });
});

describe("gatherCandidates with several focus boards", () => {
  it("takes the #1 of every board and the top 10 of each focus board, once", async () => {
    const cat = CATEGORIES.find((c) => c.boards.length >= 2)!;
    const [a, b] = cat.boards;
    const list = (p: string) => Array.from({ length: 12 }, (_, i) => ({ mainChar: `${p}${i}` }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const key = new URL(url).searchParams.get("leaderboard");
        if (key !== cat.key) return json({});
        return json({ [cat.key]: { public: { [a.apiKey]: list("a"), [b.apiKey]: list("b") } } });
      })
    );
    const names = await gatherCandidates({ focusBoard: [a.apiKey, b.apiKey] });
    expect(names).toEqual([...list("a").slice(0, 10), ...list("b").slice(0, 10)].map((e) => e.mainChar).sort());
  });
});

describe("a --saves-dir run", () => {
  it("lists the saved players and reads each save with the same checks", () => {
    const dir = mkdtempSync(join(tmpdir(), "top-profiles-"));
    try {
      writeFileSync(join(dir, "Bob.json"), JSON.stringify({ data: { x: 1 }, charNames: ["b"] }));
      writeFileSync(join(dir, "Ann.json"), JSON.stringify({ data: { x: 1 }, charNames: ["a"] }));
      writeFileSync(join(dir, "Bad.json"), JSON.stringify({ nope: true }));
      expect(savedPlayers(dir)).toEqual(["Ann", "Bad", "Bob"]);
      expect(readProfileSave(dir, "Ann")?.charNames).toEqual(["a"]);
      expect(readProfileSave(dir, "Bad")).toBeNull();
      expect(readProfileSave(dir, "Missing")).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("only names that are safe as file names are written", () => {
    expect(safeName("Arkh_BR")).toBe(true);
    expect(safeName("a/b")).toBe(false);
    expect(safeName("..")).toBe(false);
  });
});
