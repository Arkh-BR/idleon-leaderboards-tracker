import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeTome } from "@/lib/tome/compute";

// Real saves (gitignored golden cache); each block skips where its save is
// absent, so a green run without the cache proves nothing. parsedData is
// dropped so the site's own Tome computation is pinned, not IT's tomePoints.
const DIR = "scripts/updater/golden/.cache/";

// computeIdx → [TomeQTY, points]
type Pins = { total: number; tasks: Record<number, [number, number]> };

const SAVES: Record<string, Pins> = {
  "arkhe-live-2026-11-03-arkhe.json": {
    total: 55299,
    tasks: {
      0: [30638, 1190], // Stamp Total LV
      2: [1703, 1000], // Cards Total LV
      15: [13202, 257], // Star Talent Points Owned
      51: [612, 200], // Total Breedability LV
      75: [670, 100], // Total Minigame Highscore
      112: [119, 246], // Total Farming Stickers
      116: [64, 800], // Unique Sushi
    },
  },
  // CSver 30.05, migrated by lib/game. Against the old engine's 40755: Highest Drop Rate Multi is the live Drop Rate on map 251 (283.99,
  // 463 pts; the old engine's 251.24 gave 458) +5; Deathnote digits -8; the Royal Guardian rows count +10.
  "0celot8.json": {
    total: 40762,
    tasks: {
      0: [14602, 1007],
      2: [1195, 890],
      15: [3947, 206],
      51: [151, 61],
      75: [360, 80],
      112: [27, 117],
      116: [29, 363],
    },
  },
  "21ucky4u.json": {
    total: 53007,
    tasks: {
      0: [26711, 1161],
      2: [1601, 1000],
      15: [11644, 254],
      51: [599, 200],
      75: [292, 65],
      112: [97, 227],
      116: [64, 800],
    },
  },
};

for (const [file, pins] of Object.entries(SAVES)) {
  const path = DIR + file;
  describe.skipIf(!existsSync(path))(`Tome on ${file}`, () => {
    const run = () => {
      const env = JSON.parse(readFileSync(path, "utf8"));
      delete env.parsedData;
      delete env.extraData;
      return computeTome(env);
    };

    it("total score", () => {
      expect(run().totalPts).toBe(pins.total);
    });

    it("task quantities and points", () => {
      const rows = run().rows;
      for (const [ci, [qty, pts]] of Object.entries(pins.tasks)) {
        const r = rows.find((x) => x.computeIdx === Number(ci))!;
        expect([r.rawValue, r.pts], `${r.task} (TomeQTY[${ci}])`).toEqual([qty, pts]);
      }
    });
  });
}
