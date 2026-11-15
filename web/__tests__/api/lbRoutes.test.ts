import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const BASE = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";
const req = (path: string) => new NextRequest(`http://localhost/api/lb/${path}`);
const mockFetch = (body: unknown = {}) => {
  const f = vi.fn(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", f);
  return f;
};
const call = (f: ReturnType<typeof vi.fn>, i = 0) => f.mock.calls[i] as unknown as [string, RequestInit];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

const checkHeaders = (f: ReturnType<typeof vi.fn>) => {
  const h = call(f)[1].headers as Record<string, string>;
  expect(h.Origin).toBe("https://arkh-idleon-trackers.vercel.app");
  expect(h["User-Agent"]).toBe("Mozilla/5.0 (compatible; IdleonTrackersWeb/1.0)");
  expect(h).not.toHaveProperty("Referer");
};

describe("/api/lb routes", () => {
  it("meta: upstream URL + headers", async () => {
    const f = mockFetch({ tabs: [] });
    const { GET } = await import("@/app/api/lb/meta/route");
    expect((await GET()).status).toBe(200);
    expect(call(f)[0]).toBe(`${BASE}/meta`);
    checkHeaders(f);
  });

  it("player: upstream URL + headers", async () => {
    const f = mockFetch({ ranks: {} });
    const { GET } = await import("@/app/api/lb/player/route");
    expect((await GET(req("player?name=ARKHE"))).status).toBe(200);
    expect(call(f)[0]).toBe(`${BASE}/player?name=ARKHE`);
    checkHeaders(f);
  });

  it("player 404 message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { GET } = await import("@/app/api/lb/player/route");
    const r = await GET(req("player?name=nobody"));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({
      error: "Player not found. Check the name or make the profile public on Idleon Toolbox.",
    });
  });

  it("player without name is 400", async () => {
    const f = mockFetch();
    const { GET } = await import("@/app/api/lb/player/route");
    expect((await GET(req("player"))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("board: upstream URL + headers", async () => {
    const f = mockFetch({ top: [] });
    const { GET } = await import("@/app/api/lb/board/route");
    expect((await GET(req("board?metric=totalStatues&around=ARKHE&public=1"))).status).toBe(200);
    expect(call(f)[0]).toBe(`${BASE}/board?metric=totalStatues&limit=100&around=ARKHE&public=1`);
    checkHeaders(f);
  });

  it("board needs metric (400)", async () => {
    const f = mockFetch();
    const { GET } = await import("@/app/api/lb/board/route");
    expect((await GET(req("board?around=x"))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("names: upstream URL + headers", async () => {
    const f = mockFetch({ players: ["dra"] });
    const { GET } = await import("@/app/api/lb/names/route");
    expect((await GET(req("names?q=dra"))).status).toBe(200);
    expect(call(f)[0]).toBe(`${BASE}/names?q=dra`);
    checkHeaders(f);
  });

  it("names short query does not fetch", async () => {
    const f = mockFetch();
    const { GET } = await import("@/app/api/lb/names/route");
    const r = await GET(req("names?q=%20d%20"));
    expect(await r.json()).toEqual({ players: [] });
    expect(f).not.toHaveBeenCalled();
  });

  it("shared lb budget: 501st distinct fetch is 429", async () => {
    const f = mockFetch({ players: [] });
    const { __resetItFetchForTests } = await import("@/lib/leaderboards/itFetch");
    __resetItFetchForTests();
    const { GET } = await import("@/app/api/lb/names/route");
    for (let k = 0; k < 500; k++) expect((await GET(req(`names?q=aa${k}`))).status).toBe(200);
    const r = await GET(req("names?q=zzz"));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "Too many lookups today. Try again tomorrow." });
    expect(f).toHaveBeenCalledTimes(500);
  });
});
