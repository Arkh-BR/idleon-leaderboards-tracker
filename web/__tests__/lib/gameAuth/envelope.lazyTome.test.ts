import { it, expect, vi, afterEach } from "vitest";

// Records when the Tome engine is first imported.
const tome = vi.hoisted(() => ({ loaded: false }));
vi.mock("@/lib/tome/compute", () => {
  tome.loaded = true;
  return { computeTome: () => ({ totalPts: 7 }) };
});

import { fetchSaveEnvelope } from "@/lib/gameAuth/envelope";

afterEach(() => vi.unstubAllGlobals());

it("imports the Tome engine only when a save is assembled — not with the module", async () => {
  expect(tome.loaded).toBe(false); // envelope rides along on every tool page
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("documents/_data/u1")
        ? new Response(JSON.stringify({ fields: {}, createTime: "2021-01-02T03:04:05Z", updateTime: "2026-09-22T10:00:00Z" }))
        : url.includes("/_uid/u1.json")
          ? new Response(JSON.stringify(["Alpha"]))
          : new Response("null", { status: url.includes("firestore") ? 404 : 200 })
    )
  );
  const env = await fetchSaveEnvelope("u1", "tok");
  expect(tome.loaded).toBe(true);
  expect(env.extraData.totalTomePoints).toBe(7);
});
