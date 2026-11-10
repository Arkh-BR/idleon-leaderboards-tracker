// The Multikill page drops the maps whose target has no monster definition (3, 33, 34, 35: N.js itself throws there, Ruling AAA), as Damage does; every map it still
// offers computes. A sweep of the whole picker on a real save.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import { CURRENT_CSVER, InvalidSaveValue } from "@/lib/game/errors";
import { computeGameMultikill } from "@/lib/game/trackers/multikill";
import { loadMonsterMapFilter } from "@/lib/statTracker/mapFilter";
import { buildStatMapOptions } from "@/lib/statTracker/mapOptions";
import { GOLDEN_SAVES } from "../game/support/saves";

it("the page uses the shared monster-map filter", () => expect(MULTIKILL_PAGE.loadMapFilter).toBe(loadMonsterMapFilter));

// a current-CSver save (an older one is refused by design): ARKHE.json, else the first current one. Only the existence is probed at collection time; the parse is inside `it`.
const current = (p: string) => JSON.parse(readFileSync(p, "utf8")).data?.CSver === CURRENT_CSVER;
describe.skipIf(!GOLDEN_SAVES.some((p) => existsSync(p)))("every map the Multikill picker offers (real save, character 0)", () => {
  it("the filter removes exactly 3, 33, 34 and 35, and every other map computes a finite total", async (ctx) => {
    const real = [GOLDEN_SAVES.find((p) => p.endsWith("ARKHE.json")), ...GOLDEN_SAVES].find((p) => p && existsSync(p) && current(p));
    if (!real) return ctx.skip(); // saves present, none at the current CSver
    const save = JSON.parse(readFileSync(real, "utf8"));
    const all = buildStatMapOptions(save);
    expect(all.length).toBeGreaterThan(100); // a loop over nothing would pass
    const keep = await loadMonsterMapFilter();
    expect(all.filter((m) => !keep(m.index)).map((m) => m.index)).toEqual([3, 33, 34, 35]);
    const bad: string[] = [];
    for (const m of all.filter((m) => keep(m.index))) {
      try {
        const { total } = computeGameMultikill(save, 0, m.index);
        if (!Number.isFinite(total) || total < 0) bad.push(`${m.index}: total ${total}`);
      } catch (e) {
        bad.push(`${m.index}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
    // the engine still refuses the dropped maps (Ruling AAA)
    for (const i of [3, 33, 34, 35]) expect(() => computeGameMultikill(save, 0, i)).toThrow(InvalidSaveValue);
  }, 300_000);
});
