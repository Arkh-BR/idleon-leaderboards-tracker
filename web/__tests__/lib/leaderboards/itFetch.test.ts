import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetItFetchForTests, itFetchJson } from "@/lib/leaderboards/itFetch";

const ok = (body: unknown) => new Response(JSON.stringify(body));
const opts = (cacheKey: string, cap = 100) => ({ cacheKey, ttlMs: 60_000, budget: { name: "t", cap } });

beforeEach(() => {
  __resetItFetchForTests();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("itFetchJson", () => {
  it("sends SITE_HEADERS", async () => {
    const f = vi.fn(async () => ok({ a: 1 }));
    vi.stubGlobal("fetch", f);
    const r = await itFetchJson("https://x/y", opts("k"));
    expect(r).toEqual({ ok: true, data: { a: 1 }, cache: "miss" });
    const h = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(h.Origin).toBe("https://arkh-idleon-trackers.vercel.app");
    expect(h["User-Agent"]).toContain("IdleonTrackersWeb/1.0");
    expect(h).not.toHaveProperty("Referer");
  });

  it("cache hit skips fetch and the counter", async () => {
    const f = vi.fn(async () => ok({ a: 1 }));
    vi.stubGlobal("fetch", f);
    await itFetchJson("https://x/y", opts("k", 1));
    const r = await itFetchJson("https://x/y", opts("k", 1));
    expect(r).toMatchObject({ ok: true, cache: "hit" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("429 after cap", async () => {
    const f = vi.fn(async () => ok({}));
    vi.stubGlobal("fetch", f);
    await itFetchJson("u", opts("a", 2));
    await itFetchJson("u", opts("b", 2));
    const r = await itFetchJson("u", opts("c", 2));
    expect(r).toMatchObject({ ok: false, status: 429 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("404 passes through and is not cached", async () => {
    const f = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", f);
    expect(await itFetchJson("u", opts("k"))).toMatchObject({ ok: false, status: 404 });
    await itFetchJson("u", opts("k"));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('500 becomes 502 "HTTP 500"', async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    expect(await itFetchJson("u", opts("k"))).toEqual({ ok: false, status: 502, error: "HTTP 500" });
  });
});

describe("itFetchJson accept", () => {
  it("does not cache a body that accept rejects", async () => {
    const f = vi.fn(async () => ok(null));
    vi.stubGlobal("fetch", f);
    const o = { ...opts("k"), accept: (d: unknown) => d !== null };
    expect(await itFetchJson("u", o)).toMatchObject({ ok: true, data: null, cache: "miss" });
    await itFetchJson("u", o);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
