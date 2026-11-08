// The Coin Multi page offers every map the picker lists and the map sets the guild term and the multikill tier of talent 643. A sweep of the whole picker on a real save:
// the maps whose target has no monster definition are refused as N.js refuses them (Ruling TT), and this test pins exactly which ones. The page does not drop them (the
// user decides; Damage's picker drops 3/33/34/35 through `loadMapFilter`).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { CURRENT_CSVER, InvalidSaveValue } from "@/lib/game/errors";
import { computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";
import { buildStatMapOptions } from "@/lib/statTracker/mapOptions";
import { GOLDEN_SAVES } from "../game/support/arkhOracle";

it("the page drops no map", () => expect(COIN_PAGE.loadMapFilter).toBeUndefined());

/** The picker maps with no monster on their target, as the sweep found them: refused, with this message. */
const REFUSED = [
  '3 W1 · JungleZ: AFKtarget: expected a MonsterDefinitions key, got string "JungleZ"',
  '33 W1 · How Did u get here: AFKtarget: expected a MonsterDefinitions key, got string "Z"',
  '34 W1 · Miningg1: AFKtarget: expected a MonsterDefinitions key, got string "Z"',
  '35 W1 · Miningg2: AFKtarget: expected a MonsterDefinitions key, got string "Z"',
];

// a current-CSver save (an older one is refused by design): ARKHE.json, else the first current one. Only the existence is probed at collection time; the parse is inside `it`.
const current = (p: string) => JSON.parse(readFileSync(p, "utf8")).data?.CSver === CURRENT_CSVER;
describe.skipIf(!GOLDEN_SAVES.some((p) => existsSync(p)))("every map the Coin Multi picker offers (real save, character 0)", () => {
  it("computes a finite total, except the maps whose target has no monster", (ctx) => {
    const real = [GOLDEN_SAVES.find((p) => p.endsWith("ARKHE.json")), ...GOLDEN_SAVES].find((p) => p && existsSync(p) && current(p));
    if (!real) return ctx.skip(); // saves present, none at the current CSver
    const save = JSON.parse(readFileSync(real, "utf8"));
    const maps = buildStatMapOptions(save);
    expect(maps.length).toBeGreaterThan(100); // a loop over nothing would pass
    const bad: string[] = [];
    const refused: string[] = [];
    for (const m of maps) {
      try {
        const { total } = computeGameCoinMulti(save, 0, m.index);
        if (!Number.isFinite(total) || total < 0) bad.push(`${m.index}: total ${total}`);
      } catch (e) {
        if (e instanceof InvalidSaveValue) refused.push(`${m.index} ${m.label}: ${e.message}`);
        else bad.push(`${m.index}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
    expect(refused).toEqual(REFUSED);
  }, 300_000);
});
