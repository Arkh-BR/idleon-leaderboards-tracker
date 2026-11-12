import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const req = (player: string) => new NextRequest(`http://localhost/api/profile?player=${player}`);
const SAVE = { data: {}, charNames: ["a"] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("/api/profile", () => {
  it("sends the agreed Origin (exact, no trailing slash) and the site's User-Agent", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SAVE)));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/profile/route");
    expect((await GET(req("someone"))).status).toBe(200);
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.Origin).toBe("https://arkh-idleon-trackers.vercel.app");
    expect(headers["User-Agent"]).toContain("IdleonTrackersWeb/1.0");
    expect(headers).not.toHaveProperty("Referer");
  });

  it("stops at 200 upstream fetches a day; cache hits don't count", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SAVE)));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { GET } = await import("@/app/api/profile/route");
    for (let k = 0; k < 200; k++) expect((await GET(req(`p${k}`))).status).toBe(200);
    expect((await GET(req("p0"))).status).toBe(200); // cached
    expect((await GET(req("p200"))).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(200);
  });
});
