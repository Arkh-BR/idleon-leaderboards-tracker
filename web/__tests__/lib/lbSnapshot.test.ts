import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadSnapshot,
  saveSnapshot,
  computeDelta,
  netRankMovement,
  type LbSnapshot,
  type BoardDelta,
} from "@/lib/lbSnapshot";
import type { BoardResult } from "@/app/api/leaderboards/route";

// Helper to create a minimal BoardResult
try {
  vi.useFakeTimers();
} catch {}

function createBoardResult(
  overrides: Partial<BoardResult> = {}
): BoardResult {
  return {
    category: "general",
    categoryLabel: "General",
    apiKey: "test",
    label: "Test",
    myRank: null,
    myScore: null,
    top10: [],
    ...overrides,
  };
}

describe("loadSnapshot", () => {
  it("returns null for empty player", () => {
    expect(loadSnapshot("")).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(loadSnapshot("Arkh")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem("idleon-leaderboards.lb.ptsSnapshot.arkh", "not-json");
    expect(loadSnapshot("Arkh")).toBeNull();
  });

  it("returns null for malformed object", () => {
    localStorage.setItem(
      "idleon-leaderboards.lb.ptsSnapshot.arkh",
      JSON.stringify({})
    );
    expect(loadSnapshot("Arkh")).toBeNull();
  });

  it("returns snapshot when valid", () => {
    const snap: LbSnapshot = {
      savedAt: "2024-01-01T00:00:00Z",
      player: "Arkh",
      boards: {
        test1: { rank: 5, score: 1000 },
      },
    };
    localStorage.setItem(
      "idleon-leaderboards.lb.ptsSnapshot.arkh",
      JSON.stringify(snap)
    );
    const result = loadSnapshot("Arkh");
    expect(result).toEqual(snap);
  });

  it("is case-insensitive for player name", () => {
    const snap: LbSnapshot = {
      savedAt: "2024-01-01T00:00:00Z",
      player: "Arkh",
      boards: {},
    };
    localStorage.setItem(
      "idleon-leaderboards.lb.ptsSnapshot.arkh",
      JSON.stringify(snap)
    );
    expect(loadSnapshot("ARKH")).toEqual(snap);
    expect(loadSnapshot("arkh")).toEqual(snap);
  });
});

describe("saveSnapshot", () => {
  it("stores snapshot per player", () => {
    const boards = [
      createBoardResult({ apiKey: "b1", myRank: 10, myScore: 500 }),
      createBoardResult({ apiKey: "b2", myRank: 50, myScore: 100 }),
    ];
    const snap = saveSnapshot("Arkh", boards);
    expect(snap.player).toBe("Arkh");
    expect(Object.keys(snap.boards)).toEqual(["b1", "b2"]);
    expect(snap.boards["b1"]).toEqual({ rank: 10, score: 500 });
  });

  it("writes to localStorage", () => {
    saveSnapshot("Arkh", [
      createBoardResult({ apiKey: "only", myRank: 1, myScore: 9_999 }),
    ]);
    const raw = localStorage.getItem("idleon-leaderboards.lb.ptsSnapshot.arkh");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.boards["only"]).toEqual({ rank: 1, score: 9_999 });
  });
});

describe("computeDelta", () => {
  it("returns nodata when snapshot is undefined", () => {
    const result = computeDelta(
      { myRank: 10, myScore: 100 },
      undefined
    );
    expect(result.status).toBe("nodata");
    expect(result.rankDelta).toBeNull();
    expect(result.scoreDelta).toBeNull();
  });

  it("returns nodata when snapshot rank is null", () => {
    const result = computeDelta(
      { myRank: 10, myScore: 100 },
      { rank: null, score: 100 }
    );
    expect(result.status).toBe("nodata");
  });

  it("returns nodata when current rank is null", () => {
    const result = computeDelta(
      { myRank: null, myScore: 100 },
      { rank: 10, score: 100 }
    );
    expect(result.status).toBe("nodata");
  });

  it("calculates positive rankDelta when climbing (rank number decreases)", () => {
    // Was rank 50, now rank 30 → climbed 20 positions
    const result = computeDelta(
      { myRank: 30, myScore: 200 },
      { rank: 50, score: 100 }
    );
    expect(result.status).toBe("changed");
    expect(result.rankDelta).toBe(20);
    expect(result.scoreDelta).toBe(100);
  });

  it("calculates negative rankDelta when dropping", () => {
    // Was rank 30, now rank 50 → dropped 20 positions
    const result = computeDelta(
      { myRank: 50, myScore: 100 },
      { rank: 30, score: 200 }
    );
    expect(result.status).toBe("changed");
    expect(result.rankDelta).toBe(-20);
    expect(result.scoreDelta).toBe(-100);
  });

  it("returns zero deltas when unchanged", () => {
    const result = computeDelta(
      { myRank: 10, myScore: 500 },
      { rank: 10, score: 500 }
    );
    expect(result.status).toBe("changed");
    expect(result.rankDelta).toBe(0);
    expect(result.scoreDelta).toBe(0);
  });

  it("returns null scoreDelta when snapshot score is null", () => {
    const result = computeDelta(
      { myRank: 10, myScore: 100 },
      { rank: 20, score: null }
    );
    expect(result.status).toBe("changed");
    expect(result.scoreDelta).toBeNull();
  });
});

describe("netRankMovement", () => {
  it("returns zeros for empty array", () => {
    const result = netRankMovement([]);
    expect(result).toEqual({ total: 0, gained: 0, lost: 0, unchanged: 0 });
  });

  it("counts gains, losses, and unchanged correctly", () => {
    const deltas: BoardDelta[] = [
      { status: "changed", rankDelta: 10, scoreDelta: 0 },   // climbed
      { status: "changed", rankDelta: 5, scoreDelta: 0 },    // climbed
      { status: "changed", rankDelta: -3, scoreDelta: 0 },   // dropped
      { status: "changed", rankDelta: 0, scoreDelta: 0 },    // unchanged
      { status: "nodata", rankDelta: null, scoreDelta: null }, // ignored
    ];
    const result = netRankMovement(deltas);
    expect(result.total).toBe(12); // 10 + 5 - 3 + 0
    expect(result.gained).toBe(2);
    expect(result.lost).toBe(1);
    expect(result.unchanged).toBe(1);
  });

  it("skips nodata entries", () => {
    const deltas: BoardDelta[] = [
      { status: "nodata", rankDelta: null, scoreDelta: null },
      { status: "nodata", rankDelta: null, scoreDelta: null },
    ];
    const result = netRankMovement(deltas);
    expect(result).toEqual({ total: 0, gained: 0, lost: 0, unchanged: 0 });
  });
});
