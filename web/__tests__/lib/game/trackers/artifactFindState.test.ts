import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GOLDEN_SAVES } from "../support/arkhOracle";
import { buildGameState } from "@/lib/game/state";
import { computeGameArtifactFind, gameArtifactFind } from "@/lib/game/trackers/artifactFind";

// The page calls compute(save, charIdx) with the same parsed save on every character switch (StatCalculator keeps `save` in state), so the
// adapter keeps the GameState per envelope object: building it (a deep clone + freeze) and the Tome score on it are per save, not per click.
vi.mock("@/lib/game/state", async (orig) => {
  const actual = await orig<typeof import("@/lib/game/state")>();
  return { ...actual, buildGameState: vi.fn(actual.buildGameState) };
});
const build = vi.mocked(buildGameState);
beforeEach(() => {
  build.mockClear();
});

// An envelope the engine accepts but refuses to compute (every key is missing): the state is built, then the compute throws.
const empty = () => ({ charNames: ["a", "b", "c"], data: {}, companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 0, lastUpdated: 0 });

describe("computeGameArtifactFind keeps the GameState per envelope object", () => {
  it("builds the state once for any number of characters of the same object, and again for another object", () => {
    const save = empty();
    for (const ci of [0, 1, 2, 1]) expect(() => computeGameArtifactFind(save, ci)).toThrow();
    expect(build).toHaveBeenCalledTimes(1);
    expect(() => computeGameArtifactFind(empty(), 0)).toThrow();
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("does not remember an envelope the state refuses (nothing to keep), and keeps throwing for it", () => {
    for (const bad of [null, 5, "x"]) {
      expect(() => computeGameArtifactFind(bad, 0)).toThrow();
      expect(() => computeGameArtifactFind(bad, 1)).toThrow();
    }
    expect(build).toHaveBeenCalledTimes(6); // a non-object is never a cache key
  });

  const path = GOLDEN_SAVES.find((p) => basename(p) === "arkhe-live-2026-11-01.json");
  it.skipIf(!path)("gives every character the total a fresh state gives, from one state, and a trace as full as a fresh one", () => {
    const save = JSON.parse(readFileSync(path!, "utf8"));
    const chars = save.charNames.length as number;
    const kept = Array.from({ length: chars }, (_, ci) => computeGameArtifactFind(save, ci));
    expect(build).toHaveBeenCalledTimes(1);
    // the same character again (the page recomputes on a snapshot, a re-render...): the whole tree is still there, not a memo hit
    const again = computeGameArtifactFind(save, 8);
    expect(build).toHaveBeenCalledTimes(1);
    for (let ci = 0; ci < chars; ci++) {
      const fresh = gameArtifactFind(buildGameState(JSON.parse(readFileSync(path!, "utf8"))), ci);
      expect(kept[ci].total, `character ${ci}`).toBe(fresh.total);
      expect(JSON.stringify(kept[ci].tree), `character ${ci} tree`).toBe(JSON.stringify(fresh.tree));
    }
    expect(JSON.stringify(again)).toBe(JSON.stringify(kept[8]));
    expect(new Set(kept.map((r) => r.total)).size).toBeGreaterThan(1); // the characters really differ
  });
});
