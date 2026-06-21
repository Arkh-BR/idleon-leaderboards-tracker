// web/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  // Each test re-imports the middleware with a fresh config mock.
  vi.resetModules();
});

async function loadMiddleware(protestMode: boolean) {
  vi.doMock("@/lib/protest/config", () => ({ PROTEST_MODE: protestMode }));
  return (await import("@/middleware")).middleware;
}

describe("protest middleware", () => {
  it("redirects any route to /protest with a 307 when protest mode is on", async () => {
    const middleware = await loadMiddleware(true);
    const res = middleware(new NextRequest(new URL("https://site.test/leaderboards")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://site.test/protest");
  });

  it("lets the /protest route through when protest mode is on", async () => {
    const middleware = await loadMiddleware(true);
    const res = middleware(new NextRequest(new URL("https://site.test/protest")));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes everything through when protest mode is off", async () => {
    const middleware = await loadMiddleware(false);
    const res = middleware(new NextRequest(new URL("https://site.test/leaderboards")));
    expect(res.headers.get("location")).toBeNull();
  });
});
