// The EXP page offers every map the picker lists (the map sets the Arcane bonus and the medallion; EXP has no no-value map): a sweep of the
// whole picker on a real save.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { computeGameExpMulti } from "@/lib/game/trackers/expMulti";
import { buildStatMapOptions } from "@/lib/statTracker/mapOptions";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { GOLDEN_SAVES } from "../game/support/arkhOracle";

it("the page drops no map", () => expect(EXP_PAGE.loadMapFilter).toBeUndefined());

// a current-CSver save (an older one is refused by design): ARKHE.json, else the first current one; none = the sweep skips
const current = (p: string) => existsSync(p) && JSON.parse(readFileSync(p, "utf8")).data?.CSver === CURRENT_CSVER;
const REAL = [GOLDEN_SAVES.find((p) => p.endsWith("ARKHE.json")), ...GOLDEN_SAVES].find((p) => p && current(p));
describe.skipIf(!REAL)("every map the EXP picker offers computes (real save, character 0)", () => {
  it("no throw and a finite multiplier on each", () => {
    const save = JSON.parse(readFileSync(REAL!, "utf8"));
    const maps = buildStatMapOptions(save);
    expect(maps.length).toBeGreaterThan(100); // a loop over nothing would pass
    const bad: string[] = [];
    for (const m of maps) {
      try {
        const { total } = computeGameExpMulti(save, 0, m.index);
        if (!Number.isFinite(total) || total <= 0) bad.push(`${m.index}: multiplier ${total}`);
      } catch (e) {
        bad.push(`${m.index}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  }, 300_000);
});
