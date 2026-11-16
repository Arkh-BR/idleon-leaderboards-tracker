import { describe, it, expect } from "vitest";
import {
  loadSnapshot,
  saveSnapshot,
  computeDelta,
  netRankMovement,
  type LbSnapshot,
  type BoardDelta,
} from "@/lib/lbSnapshot";

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
    const snap = saveSnapshot("Arkh", { b1: { rank: 10, value: 500 }, b2: { rank: 50, value: 100 } });
    expect(snap.player).toBe("Arkh");
    expect(Object.keys(snap.boards)).toEqual(["b1", "b2"]);
    expect(snap.boards["b1"]).toEqual({ rank: 10, score: 500 });
  });

  it("writes to localStorage in the stored shape (rank + score)", () => {
    saveSnapshot("Arkh", { only: { rank: 1, value: 9_999 } });
    const raw = localStorage.getItem("idleon-leaderboards.lb.ptsSnapshot.arkh");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.boards["only"]).toEqual({ rank: 1, score: 9_999 });
  });
});

describe("computeDelta", () => {
  const snap = (boards: LbSnapshot["boards"]): LbSnapshot => ({ savedAt: "2024-01-01T00:00:00Z", player: "Arkh", boards });

  it("nodata for every board when there is no snapshot", () => {
    expect(computeDelta({ a: { rank: 10, value: 100 } }, null)).toEqual({ a: { status: "nodata", rankDelta: null, scoreDelta: null } });
  });

  it("nodata when the board is missing from the snapshot or its rank is null", () => {
    const d = computeDelta({ a: { rank: 10, value: 100 }, b: { rank: 10, value: 100 } }, snap({ b: { rank: null, score: 100 } }));
    expect(d.a.status).toBe("nodata");
    expect(d.b.status).toBe("nodata");
  });

  it("positive rankDelta when climbing, negative when dropping, zero when unchanged", () => {
    const d = computeDelta(
      { up: { rank: 30, value: 200 }, down: { rank: 50, value: 100 }, same: { rank: 10, value: 500 } },
      snap({ up: { rank: 50, score: 100 }, down: { rank: 30, score: 200 }, same: { rank: 10, score: 500 } }),
    );
    expect(d.up).toEqual({ status: "changed", rankDelta: 20, scoreDelta: 100 });
    expect(d.down).toEqual({ status: "changed", rankDelta: -20, scoreDelta: -100 });
    expect(d.same).toEqual({ status: "changed", rankDelta: 0, scoreDelta: 0 });
  });

  it("null scoreDelta when snapshot score is null", () => {
    const d = computeDelta({ a: { rank: 10, value: 100 } }, snap({ a: { rank: 20, score: null } }));
    expect(d.a).toEqual({ status: "changed", rankDelta: 10, scoreDelta: null });
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
