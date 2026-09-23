import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSaveEnvelope, NoCharactersError } from "@/lib/gameAuth/envelope";

const doc = (fields: Record<string, unknown>) => ({
  name: "doc",
  fields,
  createTime: "2021-01-02T03:04:05.678Z",
  updateTime: "2026-09-22T10:00:00.123456Z",
});
const int = (n: number) => ({ integerValue: String(n) });

// Routes by URL substring. Unrouted Firestore docs → 404; unrouted RTDB → null.
function mockGame(routes: Record<string, unknown>) {
  const f = vi.fn(async (url: string, _init?: RequestInit) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (key) return new Response(JSON.stringify(routes[key]), { status: 200 });
    return url.includes("firestore.googleapis.com")
      ? new Response("{}", { status: 404 })
      : new Response("null", { status: 200 });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

// >100 keys so computeTome unwraps the envelope — and would write side
// fields into `data` if it weren't handed a copy.
const bigSave = {
  Guild: { stringValue: "[1,2]" },
  Lv0_0: int(5),
  ...Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`K${i}`, int(i)])),
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchSaveEnvelope", () => {
  it("assembles the IdleonToolbox-compatible envelope", async () => {
    mockGame({
      "documents/_data/u1": doc(bigSave),
      "/_uid/u1.json": ["Alpha", "Beta"],
      "/_comp/u1.json": { l: [1] },
      "/_usgu/u1/g.json": "G1",
      "/_guild/G1.json": { m: { a: { n: "Alpha" } }, p: 42 },
      "/_tournament/u1.json": { w: 1 },
      "documents/_T_RES_UID/u1": doc({ r: int(3) }),
      "documents/_TOURNAMENT/_TOURNAMENT": doc({ T: int(7) }),
      "documents/_vars/_vars": doc({ X: int(1) }),
    });
    const env = await fetchSaveEnvelope("u1", "tok");
    expect(env.charNames).toEqual(["Alpha", "Beta"]);
    expect(env.data.Lv0_0).toBe(5);
    expect(env.data).not.toHaveProperty("companion"); // computeTome got a copy
    expect(env.companion).toEqual({ l: [1] });
    expect(env.guildData).toEqual({ id: "G1", stats: [1, 2], members: [{ n: "Alpha" }], points: 42 });
    expect(env.serverVars).toEqual({ X: 1 });
    expect(env.tournament).toEqual({ user: { w: 1 }, match: { r: 3 }, global: { T: 7 }, leaderboard: [] });
    expect(env.accountCreateTime).toBe(Date.parse("2021-01-02T03:04:05Z"));
    expect(env.lastUpdated).toBe(Date.parse("2026-09-22T10:00:00.123Z"));
    expect(typeof env.extraData.totalTomePoints).toBe("number");
  });

  it("reads everything with GET and the user's token", async () => {
    const f = mockGame({
      "documents/_data/u1": doc(bigSave),
      "/_uid/u1.json": ["Alpha"],
      "/_usgu/u1/g.json": "G1",
    });
    await fetchSaveEnvelope("u1", "tok");
    expect(f.mock.calls.length).toBe(9); // 8 in parallel + the guild
    for (const [url, init] of f.mock.calls) {
      expect(init?.method ?? "GET").toBe("GET");
      if (url.includes("firestore.googleapis.com")) {
        expect(init?.headers).toEqual({ Authorization: "Bearer tok" });
      } else {
        expect(url).toContain("?auth=tok");
      }
    }
  });

  it("missing side data → nulls, not a failure", async () => {
    mockGame({ "documents/_data/u1": doc({ Lv0_0: int(1) }), "/_uid/u1.json": ["Alpha"] });
    const env = await fetchSaveEnvelope("u1", "tok");
    expect(env.companion).toBeNull();
    expect(env.guildData).toEqual({ id: null, stats: null, members: [], points: null });
    expect(env.serverVars).toBeNull();
    expect(env.tournament).toEqual({ user: null, match: null, global: null, leaderboard: [] });
  });

  it("no characters → NoCharactersError; no save → NoCharactersError asking about the account", async () => {
    mockGame({ "documents/_data/u1": doc({}) });
    const noChars = fetchSaveEnvelope("u1", "tok");
    await expect(noChars).rejects.toBeInstanceOf(NoCharactersError);
    await expect(noChars).rejects.toThrow("No characters found for this account");
    mockGame({ "/_uid/u1.json": ["Alpha"] });
    const noSave = fetchSaveEnvelope("u1", "tok");
    await expect(noSave).rejects.toBeInstanceOf(NoCharactersError);
    await expect(noSave).rejects.toThrow(
      "No save found for this account — is this the account you play Idleon with?"
    );
  });
});
