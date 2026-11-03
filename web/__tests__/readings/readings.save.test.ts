import { describe, it, expect } from "vitest";
import { computeReadingValue } from "@/lib/readings/compute";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatKey } from "@/lib/readings/types";

// Every recorded in-game reading (the main stat and each `extra`) in the game's
// own display format. Saves are private (gitignored): a reading without its save
// is skipped, so a green run without them proves little. lib/arkh is a
// singleton, so the rows run one after another and each reloads its save.
//
// Known engine gaps keep the exact assert and run through it.fails: the row
// stays green while the engine is off, and turns red the day it matches the
// game — delete the entry then.
const KNOWN_GAPS = new Set([
  // 8 digits sit ~1.2e-6 under the game (see damage-live-2026-11-03.save.test.ts).
  "2026-11-03-damage-farkhe damage",
]);

const rows = loadReadings().flatMap((r) => {
  const save = readingSave(r);
  return Object.entries({ [r.stat]: r.game, ...r.extra }).map(([stat, game]) => ({ r, save, stat: stat as StatKey, game }));
});

describe("recorded in-game readings", () => {
  for (const { r, save, stat, game } of rows) {
    const name = `${r.id} ${stat}`;
    const run = !save ? it.skip : KNOWN_GAPS.has(name) ? it.fails : it;
    run(name, async () => {
      const site = formatGameValue(stat, await computeReadingValue(r, save, stat));
      expect(normalizeGameText(site)).toBe(normalizeGameText(game));
    });
  }
});
