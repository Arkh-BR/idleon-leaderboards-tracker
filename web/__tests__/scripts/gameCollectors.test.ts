// The collectors' round trip on the newest local save (skipped without the private saves in golden/.cache): for each collector,
// combine(computePools(save, ci)) gives the tracker's total and the tracker's flat tree at item level and above. Tasks 3-5 add a row per collector
// to CASES.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bestMap, groupedCombine, MAP_PICKS, pickMap, poolsOf } from "@/scripts/_shared/gamePools";
import type { StatCollectorConfig } from "@/scripts/_shared/topStatCollector";
import { newestSaves } from "@/lib/diagnose/characterize";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { listCharacters } from "@/lib/dropRate/extract";
import type { StatResult } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";
import { near, stateOf } from "@/lib/game/trackers/page";
import { makeCtx } from "@/lib/game/ctx";
import { MapAFKtarget } from "@/lib/game/data";
import { COIN_CLASS_TALENTS, COIN_GROUPS, COIN_ROOT } from "@/lib/coinMulti/layers";
import { EXP_CLASS_TALENTS } from "@/lib/expMulti/layers";
import { DR2_CLASS_TALENTS } from "@/lib/dropRateV2/layers";
import { computeGameExpMulti } from "@/lib/game/trackers/expMulti";
import { computeGameDropRate } from "@/lib/game/trackers/dropRate";
import { computeGameArtifactFind } from "@/lib/game/trackers/artifactFind";
import { COIN_COLLECTOR } from "@/scripts/update-top-coin";
import { EXP_COLLECTOR } from "@/scripts/update-top-exp";
import { DR2_COLLECTOR } from "@/scripts/update-top-dr2";
import { ARTIFACT_COLLECTOR } from "@/scripts/update-top-artifact";

const DIR = "scripts/updater/golden/.cache";
const newest = existsSync(DIR) ? newestSaves(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => join(DIR, f)), 1)[0] : undefined;
const save = newest ? JSON.parse(readFileSync(newest, "utf8").replace(/^﻿/, "")) : undefined;
const chars = save ? listCharacters(save) : [];

/** The flat tree from 1 to `depth` segments below the root (the pools' items sit at depth 2 in a grouped tree). The root is the total, checked with `near`:
 *  the collector's comes from the page model, the tracker's from N.js, a few ulps apart. */
const upTo = (flat: Record<string, number>, depth: number) => Object.fromEntries(Object.entries(flat).filter(([p]) => p.includes(" / ") && p.split(" / ").length <= depth + 1));

/** A collector's round trip: its pools recombined against the tracker on the same character. `talents`: the class talents the runner gates by
 *  node name ("(Talent n)"), each an item of the pools. */
type Case = { name: string; cfg: Pick<StatCollectorConfig, "computePools" | "combine">; tracker: (save: unknown, ci: number) => StatResult; depth: number; talents: readonly number[] };
const CASES: Case[] = [
  { name: "Coin Multi (map 301)", cfg: COIN_COLLECTOR, tracker: (s, ci) => computeGameCoinMulti(s, ci, 301), depth: 2, talents: COIN_CLASS_TALENTS },
  { name: "EXP Multi (best EXP map)", cfg: EXP_COLLECTOR, tracker: (s, ci) => computeGameExpMulti(s, ci, pickMap(s, ci, MAP_PICKS.exp)), depth: 2, talents: EXP_CLASS_TALENTS },
  { name: "Drop Rate V2 (best DR map)", cfg: DR2_COLLECTOR, tracker: (s, ci) => computeGameDropRate(s, ci, pickMap(s, ci, MAP_PICKS.dr2)), depth: 2, talents: DR2_CLASS_TALENTS },
  { name: "Artifact Find (no map)", cfg: ARTIFACT_COLLECTOR, tracker: computeGameArtifactFind, depth: 2, talents: [] },
];

describe.skipIf(!save)("the collectors' round trip on the newest save", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_n, c) => {
    for (const ch of chars) {
      const want = c.tracker(save, ch.charIndex);
      const got = c.cfg.combine(c.cfg.computePools(save, ch.charIndex));
      expect(near(got.total, want.total)).toBe(true);
      expect(upTo(flattenTree(got.tree), c.depth)).toEqual(upTo(flattenTree(want.tree), c.depth));
      const items = got.tree.children!.flatMap((g) => g.children ?? []).map((i) => i.name);
      for (const id of c.talents) expect(items.some((n) => n.endsWith(`(Talent ${id})`)), `talent ${id}`).toBe(true);
    }
  });

  it("poolsOf + groupedCombine rebuild a grouped tracker's tree and total (Coin, map 301)", () => {
    const parents = Object.fromEntries(COIN_GROUPS.map((g) => [g.key, `${COIN_ROOT} / ${g.name}`]));
    const combine = groupedCombine(COIN_ROOT, COIN_GROUPS, groupedGainsModel(COIN_ROOT, COIN_GROUPS));
    const want = computeGameCoinMulti(save, chars[0].charIndex, 301);
    const got = combine(poolsOf(want.tree, parents));
    expect(near(got.total, want.total)).toBe(true);
    expect(upTo(flattenTree(got.tree), 2)).toEqual(upTo(flattenTree(want.tree), 2));
  });

  it("bestMap picks an accepted map no other accepted map outscores (DR V2)", () => {
    const { score, accept } = MAP_PICKS.dr2;
    const ci = chars[0].charIndex;
    const m = bestMap(save, ci, score, accept);
    expect(accept(m)).toBe(true);
    const at = (map: number) => score(makeCtx(stateOf(save), { player: ci, map }));
    for (let o = 0; o < MapAFKtarget.length; o++) if (accept(o)) expect(at(o)).toBeLessThanOrEqual(at(m));
  });
});
