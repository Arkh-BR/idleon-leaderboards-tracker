// The AFK page offers every map (a no-fight map is a 0 on the page, Ruling DD): a sweep of the whole picker on a real save.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";
import { computeGameAfkGains } from "@/lib/game/trackers/afkGains";
import { buildStatMapOptions } from "@/lib/statTracker/mapOptions";
import { GOLDEN_SAVES } from "../game/support/arkhOracle";

it("the page drops no map", () => expect(AFK_PAGE.loadMapFilter).toBeUndefined());

const REAL = GOLDEN_SAVES.find((p) => p.endsWith("ARKHE.json")) ?? GOLDEN_SAVES[0];
describe.skipIf(!REAL || !existsSync(REAL))("every map the AFK picker offers computes (real save, character 0)", () => {
  it("no throw and a finite rate on each", () => {
    const save = JSON.parse(readFileSync(REAL, "utf8"));
    const maps = buildStatMapOptions(save);
    expect(maps.length).toBeGreaterThan(100); // a loop over nothing would pass
    const bad: string[] = [];
    let zero = 0;
    for (const m of maps) {
      try {
        const { total } = computeGameAfkGains(save, 0, m.index);
        if (!Number.isFinite(total) || total < 0) bad.push(`${m.index}: rate ${total}`);
        if (total === 0) zero++;
      } catch (e) {
        bad.push(`${m.index}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
    expect(zero).toBeGreaterThan(0); // the no-fight maps are a 0, not a refusal
    expect(zero).toBeLessThan(maps.length);
  }, 300_000);
});
