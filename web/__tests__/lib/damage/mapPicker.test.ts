// The maps the Damage page offers: the ones whose MapAFKtarget is a monster (the game has no Damage value on the others), what the
// page selects when the character stands on one that is not offered, and a sweep of the whole picker on a real save.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";
import { loadMonsterMapFilter } from "@/lib/statTracker/mapFilter";
import { computeGameDamage } from "@/lib/game/trackers/damage";
import { buildStatMapOptions, defaultMapIndex } from "@/lib/statTracker/mapOptions";
import { GOLDEN_SAVES } from "../game/support/saves";

const offered = async (save: unknown) => {
  const keep = await loadMonsterMapFilter();
  return buildStatMapOptions(save).filter((m) => keep(m.index));
};

describe("the Damage map picker", () => {
  it("is wired into the page config", () => {
    expect(DAMAGE_PAGE.loadMapFilter).toBe(loadMonsterMapFilter);
  });
  it("drops exactly JungleZ (3), 33, Miningg1 (34) and Miningg2 (35): the maps whose MapAFKtarget is not a monster", async () => {
    const all = buildStatMapOptions({ data: {} });
    const shown = await offered({ data: {} });
    const dropped = all.filter((m) => !shown.some((s) => s.index === m.index)).map((m) => m.index);
    expect(dropped).toEqual([3, 33, 34, 35]);
    expect(shown).toHaveLength(all.length - 4);
  });
  it("a character saved on a dropped map starts on the first offered map; on an offered one, on its own", async () => {
    const shown = await offered({ data: { CurrentMap_0: 33, CurrentMap_1: 14 } });
    expect(shown.some((m) => m.index === 33)).toBe(false); // even a character's own map is filtered
    expect(defaultMapIndex(shown, 33)).toBe(shown[0].index);
    expect(defaultMapIndex(shown, 14)).toBe(14);
  });
});

const REAL = GOLDEN_SAVES.find((p) => p.endsWith("ARKHE.json")) ?? GOLDEN_SAVES[0];
describe.skipIf(!REAL || !existsSync(REAL))("every map the Damage picker offers computes (real save, character 0)", () => {
  it("no throw and a finite Max on each; the dropped maps are the ones that refuse", async () => {
    const save = JSON.parse(readFileSync(REAL, "utf8"));
    const shown = await offered(save);
    expect(shown.length).toBeGreaterThan(100); // a loop over nothing would pass
    const bad: string[] = [];
    for (const m of shown) {
      try {
        const { total } = computeGameDamage(save, 0, m.index);
        if (!Number.isFinite(total)) bad.push(`${m.index}: Max ${total}`);
      } catch (e) {
        bad.push(`${m.index}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
    for (const dropped of [3, 33, 34, 35]) expect(() => computeGameDamage(save, 0, dropped), `map ${dropped}`).toThrow(); // the negative control
  }, 300_000);
});
