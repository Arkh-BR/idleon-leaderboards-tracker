import { describe, it, expect } from "vitest";
import { computeReadingValue } from "@/lib/readings/compute";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { loadReadings, readingSave, readingValues } from "@/lib/readings/registry";

// Every recorded in-game reading (the main stat and each `extra`) in the game's
// own display format. Saves are private (gitignored): a reading without its save
// is skipped, so a green run without them proves little.
//
// Known engine gaps (`knownGaps` in fixtures/readings.json) keep the exact assert and run
// through it.fails: the row stays green while the engine is off, and turns red the day it
// matches the game: delete the entry then. verify-map does not count them as validation.
// Today: farkhe damage (8 digits sit ~1.2e-6 under the game, see damage-live-2026-11-03.save.test.ts).

const rows = loadReadings().flatMap((r) => {
  const save = readingSave(r);
  return readingValues(r).map(({ stat, game }) => ({ r, save, stat, game }));
});

describe("recorded in-game readings", () => {
  for (const { r, save, stat, game } of rows) {
    const name = `${r.id} ${stat}`;
    const run = !save ? it.skip : r.knownGaps?.includes(stat) ? it.fails : it;
    run(name, async () => {
      const site = formatGameValue(stat, await computeReadingValue(r, save, stat));
      expect(normalizeGameText(site)).toBe(normalizeGameText(game));
    });
  }
});
