import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

import { GET, type LeaderboardsResponse } from "@/app/api/leaderboards/route";

function makeReq(searchParams: Record<string, string>) {
  const url = new URL("http://localhost/api/leaderboards");
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  return { nextUrl: url, headers: new Headers(), cookies: { get: () => undefined } } as any;
}

function createJsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("GET /api/leaderboards", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns 400 when player is missing", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing ?player=" });
  });

  it("returns 400 when player is empty or whitespace", async () => {
    const res = await GET(makeReq({ player: "   " }));
    expect(res.status).toBe(400);
  });

  it("fetches and aggregates leaderboard data for a player", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : (input as any).url || String(input));
      const lb = url.searchParams.get("leaderboard") || "";
      const user = url.searchParams.get("leaderboardUser");

      if (!user) {
        const categoryData: Record<string, any> = {
          global: {
            global: {
              public: {
                globalRanking: [
                  { mainChar: "Alice", rank: 1, globalRanking: 1_000_000 },
                  { mainChar: "Bob", rank: 2, globalRanking: 900_000 },
                ],
              },
              anonymous: {
                globalRanking: [
                  { mainChar: "Alice", rank: 1, globalRanking: 1_000_000 },
                  { mainChar: "Anon#12345", rank: 2, globalRanking: 950_000 },
                  ...Array.from({ length: 8 }).map((_, i) => ({
                    mainChar: `Filler${i}`,
                    rank: i + 3,
                    globalRanking: 800_000 - i * 10_000,
                  })),
                ],
              },
            },
          },
          general: {
            general: {
              public: {
                totalMoney: [{ mainChar: "Alice", rank: 1, totalMoney: 500 }],
              },
              anonymous: {
                totalMoney: [
                  { mainChar: "Alice", rank: 1, totalMoney: 500 },
                  { mainChar: "Anon#99999", rank: 2, totalMoney: 400 },
                ],
              },
            },
          },
          tasks: { tasks: { public: {}, anonymous: {} } },
          skills: { skills: { public: {}, anonymous: {} } },
          character: { character: { public: {}, anonymous: {} } },
          misc: { misc: { public: {}, anonymous: {} } },
          caverns: { caverns: { public: {}, anonymous: {} } },
        };
        return createJsonResponse(categoryData[lb] || {});
      }

      const userData: Record<string, any> = {
        global: { globalRanking: { mainChar: user, rank: 2, globalRanking: 900_000 } },
        general: { totalMoney: [{ mainChar: user, rank: 1, totalMoney: 500 }] },
        tasks: {},
        skills: {},
        character: {},
        misc: {},
        caverns: {},
      };
      return createJsonResponse(userData[lb] || {});
    });

    const res = await GET(makeReq({ player: "Bob" }));
    const json: LeaderboardsResponse = await res.json();

    expect(res.status).toBe(200);
    expect(json.player).toBe("Bob");
    expect(Array.isArray(json.boards)).toBe(true);
    expect(json.boards.length).toBeGreaterThan(0);

    const globalRankingBoard = json.boards.find(
      (b) => b.category === "global" && b.apiKey === "globalRanking"
    );
    expect(globalRankingBoard).toBeDefined();
    expect(globalRankingBoard?.myRank).toBe(2);
    expect(globalRankingBoard?.myScore).toBe(900_000);
    expect(globalRankingBoard?.top10.length).toBeLessThanOrEqual(10);
    expect(globalRankingBoard?.top10[0].name).toBe("Alice");
  });

  it("aggregates errors when some categories fail", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        throw new Error("Network error");
      }
      return createJsonResponse({ public: {}, anonymous: {} });
    });

    const res = await GET(makeReq({ player: "TestPlayer" }));
    const json: LeaderboardsResponse = await res.json();

    expect(res.status).toBe(200);
    expect(json.errors.length).toBeGreaterThan(0);
    expect(json.boards.length).toBeGreaterThan(0);
  });

  it("respects cache and returns cached data on subsequent calls", async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ public: {}, anonymous: {} }));

    const req1 = await GET(makeReq({ player: "CachedPlayer" }));
    expect(req1.headers.get("x-cache")).toBe("miss");

    const req2 = await GET(makeReq({ player: "CachedPlayer" }));
    expect(req2.headers.get("x-cache")).toBe("hit");
  });

  it("bypasses cache when force=1 is provided", async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ public: {}, anonymous: {} }));

    const req1 = await GET(makeReq({ player: "ForcedPlayer" }));
    expect(req1.headers.get("x-cache")).toBe("miss");

    const req2 = await GET(makeReq({ player: "ForcedPlayer", force: "1" }));
    expect(req2.headers.get("x-cache")).toBe("miss");
  });

  it("filters anonymous entries when hideAnon=1", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : (input as any).url || String(input));
      const user = url.searchParams.get("leaderboardUser");
      const lb = url.searchParams.get("leaderboard") || "";

      if (!user) {
        return createJsonResponse({
          global: {
            public: {
              globalRanking: [{ mainChar: "Alice", rank: 1, globalRanking: 1 }],
            },
            anonymous: {
              globalRanking: [
                { mainChar: "Alice", rank: 1, globalRanking: 1 },
                { mainChar: "Anon#123", rank: 2, globalRanking: 0 },
              ],
            },
          },
        });
      }
      return createJsonResponse({
        globalRanking: { mainChar: user, rank: 1, globalRanking: 1 },
      });
    });

    const res = await GET(makeReq({ player: "Alice", hideAnon: "1" }));
    const json: LeaderboardsResponse = await res.json();

    const board = json.boards.find(
      (b) => b.category === "global" && b.apiKey === "globalRanking"
    );
    expect(board).toBeDefined();
    expect(board?.top10.length).toBe(1);
    expect(board?.top10[0].name).toBe("Alice");
  });
});
