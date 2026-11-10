// The Drop Rate V2 page offers every map the picker lists (the map sets the Arcane multiplier and, on 216, the Cove; map 33 has no monster and still has a value): a sweep of the
// whole picker on a real save.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";
import { computeGameDropRate } from "@/lib/game/trackers/dropRate";
import { buildStatMapOptions } from "@/lib/statTracker/mapOptions";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { GOLDEN_SAVES } from "../game/support/saves";

it("the page drops no map", () => expect(DR2_PAGE.loadMapFilter).toBeUndefined());

// a current-CSver save (an older one is refused by design): ARKHE.json, else the first current one. Only the existence is probed at collection time; the parse is inside `it`.
const current = (p: string) => JSON.parse(readFileSync(p, "utf8")).data?.CSver === CURRENT_CSVER;
describe.skipIf(!GOLDEN_SAVES.some((p) => existsSync(p)))("every map the Drop Rate V2 picker offers computes (real save, character 0)", () => {
  it("no throw and a finite total on each", (ctx) => {
    const real = [GOLDEN_SAVES.find((p) => p.endsWith("ARKHE.json")), ...GOLDEN_SAVES].find((p) => p && existsSync(p) && current(p));
    if (!real) return ctx.skip(); // saves present, none at the current CSver
    const save = JSON.parse(readFileSync(real, "utf8"));
    const maps = buildStatMapOptions(save);
    expect(maps.length).toBeGreaterThan(100); // a loop over nothing would pass
    const bad: string[] = [];
    for (const m of maps) {
      try {
        const { total } = computeGameDropRate(save, 0, m.index);
        if (!Number.isFinite(total) || total < 0) bad.push(`${m.index}: total ${total}`);
      } catch (e) {
        bad.push(`${m.index}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);
});
