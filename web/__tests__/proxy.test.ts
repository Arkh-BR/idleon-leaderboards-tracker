// web/__tests__/proxy.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  // Each test re-imports the proxy with a fresh config mock.
  vi.resetModules();
});

async function loadProxy(protestMode: boolean) {
  vi.doMock("@/lib/protest/config", () => ({ PROTEST_MODE: protestMode }));
  return (await import("@/proxy")).proxy;
}

describe("protest proxy", () => {
  it("redirects any route to /protest with a 307 when protest mode is on", async () => {
    const proxy = await loadProxy(true);
    const res = proxy(new NextRequest(new URL("https://site.test/leaderboards")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://site.test/protest");
  });

  it("lets the /protest route through when protest mode is on", async () => {
    const proxy = await loadProxy(true);
    const res = proxy(new NextRequest(new URL("https://site.test/protest")));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes everything through when protest mode is off", async () => {
    const proxy = await loadProxy(false);
    const res = proxy(new NextRequest(new URL("https://site.test/leaderboards")));
    expect(res.headers.get("location")).toBeNull();
  });
});
