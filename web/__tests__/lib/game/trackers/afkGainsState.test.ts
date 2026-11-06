import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GOLDEN_SAVES } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { buildGameState } from "@/lib/game/state";
import { computeGameAfkGains, gameAfk } from "@/lib/game/trackers/afkGains";
import { computeGameDamage } from "@/lib/game/trackers/damage";

// The page calls compute(save, charIdx, mapIdx) with the same parsed save on every character or map switch, so the adapter keeps the GameState
// per envelope object (trackers/page.ts, shared with Damage and Artifact Find): building it (a deep clone + freeze) and the Tome score on it are
// per save, not per click.
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

describe("computeGameAfkGains keeps the GameState per envelope object", () => {
  it("builds the state once for any number of characters and maps of the same object (and for Damage on it), again for another", () => {
    const save = empty();
    for (const [ci, map] of [[0, 251], [1, 0], [2, 306], [1, 216]]) expect(() => computeGameAfkGains(save, ci, map)).toThrow();
    expect(() => computeGameDamage(save, 0, 251)).toThrow();
    expect(build).toHaveBeenCalledTimes(1);
    expect(() => computeGameAfkGains(empty(), 0, 251)).toThrow();
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("does not remember an envelope the state refuses (nothing to keep), and keeps throwing for it", () => {
    for (const bad of [null, 5, "x"]) {
      expect(() => computeGameAfkGains(bad, 0, 251)).toThrow();
      expect(() => computeGameAfkGains(bad, 1, 251)).toThrow();
    }
    expect(build).toHaveBeenCalledTimes(6); // a non-object is never a cache key
  });

  const path = GOLDEN_SAVES.find((p) => basename(p) === "arkhe-live-2026-11-03-farkhe.json");
  it.skipIf(!path)("gives every character the total and tree a fresh state gives, from one state, the same character again included", () => {
    const save = JSON.parse(readFileSync(path!, "utf8"));
    const chars = save.charNames.length as number;
    const kept = Array.from({ length: chars }, (_, ci) => computeGameAfkGains(save, ci, 251));
    const again = computeGameAfkGains(save, 3, 251); // a re-render: the whole tree is still there, not a memo hit
    expect(build).toHaveBeenCalledTimes(1);
    for (let ci = 0; ci < chars; ci++) {
      const fresh = gameAfk(buildGameState(JSON.parse(readFileSync(path!, "utf8"))), ci, 251);
      expect(kept[ci].total, `character ${ci}`).toBe(fresh.total);
      expect(JSON.stringify(kept[ci].tree), `character ${ci} tree`).toBe(JSON.stringify(fresh.tree));
    }
    expect(JSON.stringify(again)).toBe(JSON.stringify(kept[3]));
    expect(new Set(kept.map((r) => r.total)).size).toBeGreaterThan(1); // the characters really differ
  }, 120_000);

  // The page computes only on lib/game; lib/arkh (the Observed Max collector's engine, scripts/update-top-afk.ts) runs offline on its own
  // parse. Were both run on one envelope, lib/game's answer must not depend on the order: lib/arkh leaves the envelope as it found it, and
  // stateOf deep-clones it on the first build.
  it.skipIf(!path)("gives the same results on an envelope lib/arkh computed on, before or after it", () => {
    const read = () => JSON.parse(readFileSync(path!, "utf8"));
    const cases = [[0, 251], [3, 306], [3, 6], [5, 251]] as const;
    const game = (env: unknown) => cases.map(([ci, map]) => JSON.stringify(computeGameAfkGains(env, ci, map)));
    const arkh = (env: unknown) => cases.forEach(([ci, map]) => computeArkhAfkGains(env, ci, map));

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
    expect(new Set(first).size).toBeGreaterThan(1); // the cases really differ
  }, 120_000);
});
