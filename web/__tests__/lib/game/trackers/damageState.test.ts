import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GOLDEN_SAVES } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { computeArkhDamage } from "@/lib/arkh/computeDamage";
import { buildGameState } from "@/lib/game/state";
import { computeGameArtifactFind } from "@/lib/game/trackers/artifactFind";
import { computeGameDamage, gameDamage } from "@/lib/game/trackers/damage";

// The page calls compute(save, charIdx, mapIdx) with the same parsed save on every character or map switch (StatCalculator keeps `save` in
// state), so the adapter keeps the GameState per envelope object (trackers/page.ts, shared with Artifact Find): building it (a deep clone +
// freeze) and the Tome score on it are per save, not per click.
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

describe("computeGameDamage keeps the GameState per envelope object", () => {
  it("builds the state once for any number of characters and maps of the same object (and for Artifact Find on it), again for another", () => {
    const save = empty();
    for (const [ci, map] of [[0, 251], [1, 43], [2, 306], [1, 251]]) expect(() => computeGameDamage(save, ci, map)).toThrow();
    expect(() => computeGameArtifactFind(save, 0)).toThrow();
    expect(build).toHaveBeenCalledTimes(1);
    expect(() => computeGameDamage(empty(), 0, 251)).toThrow();
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("does not remember an envelope the state refuses (nothing to keep), and keeps throwing for it", () => {
    for (const bad of [null, 5, "x"]) {
      expect(() => computeGameDamage(bad, 0, 251)).toThrow();
      expect(() => computeGameDamage(bad, 1, 251)).toThrow();
    }
    expect(build).toHaveBeenCalledTimes(6); // a non-object is never a cache key
  });

  const path = GOLDEN_SAVES.find((p) => basename(p) === "arkhe-live-2026-11-03-farkhe.json");
  it.skipIf(!path)("gives every character the total and tree a fresh state gives, from one state, the same character again included", () => {
    const save = JSON.parse(readFileSync(path!, "utf8"));
    const chars = save.charNames.length as number;
    const kept = Array.from({ length: chars }, (_, ci) => computeGameDamage(save, ci, 150));
    const again = computeGameDamage(save, 3, 150); // a re-render: the whole tree is still there, not a memo hit
    expect(build).toHaveBeenCalledTimes(1);
    for (let ci = 0; ci < chars; ci++) {
      const fresh = gameDamage(buildGameState(JSON.parse(readFileSync(path!, "utf8"))), ci, 150);
      expect(kept[ci].total, `character ${ci}`).toBe(fresh.total);
      expect(JSON.stringify(kept[ci].tree), `character ${ci} tree`).toBe(JSON.stringify(fresh.tree));
    }
    expect(JSON.stringify(again)).toBe(JSON.stringify(kept[3]));
    expect(new Set(kept.map((r) => r.total)).size).toBeGreaterThan(1); // the characters really differ
  }, 120_000);

  // The page computes only on lib/game; lib/arkh (the Observed Max collector's engine, scripts/update-top-damage.ts) runs offline on its
  // own parse. Were both run on one envelope, lib/game's answer must not depend on the order: lib/arkh leaves the envelope as it found it
  // (checked on every real save: computeArkhDamage, its pools and Artifact Find), and stateOf deep-clones it on the first build.
  it.skipIf(!path)("gives the same results on an envelope lib/arkh computed on, before or after it", () => {
    const read = () => JSON.parse(readFileSync(path!, "utf8"));
    const cases = [[0, 251], [3, 43], [3, 306], [5, 40]] as const;
    const game = (env: unknown) => cases.map(([ci, map]) => JSON.stringify(computeGameDamage(env, ci, map)));
    const arkh = (env: unknown) => cases.forEach(([ci, map]) => computeArkhDamage(env, ci, map));

    const a = read(); // lib/arkh first
    const raw = JSON.stringify(a);
    arkh(a);
    expect(JSON.stringify(a)).toBe(raw);
    const afterArkh = game(a);

    const b = read(); // lib/game first, then lib/arkh, then lib/game again
    const first = game(b);
    arkh(b);
    expect(game(b)).toEqual(first);
    expect(afterArkh).toEqual(first);
    expect(new Set(first).size).toBe(cases.length); // the cases really differ
  }, 120_000);
});
