import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDamage } from "@/lib/arkh/computeDamage";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real saves (gitignored golden cache); skips in CI where they're absent.
// ARKHE, 2026-11-03 00:27–00:54Z, each save captured at the moment of an
// in-game Player Info reading of the character, on map 150. From 1e34 up the
// panel shows "Min~Max" as ceil(x/1e30) plus a glyph (N.js @6710825), so
// "16475" means a Max in (16474e30, 16475e30].
const DIR = "scripts/updater/golden/.cache/";
type Reading = { file: string; who: string; ci: number; game: string };
const READINGS: Reading[] = [
  { file: "arkhe-live-2026-11-03-arkhe.json", who: "ARKHE (#0)", ci: 0, game: "9030~16475" },
  { file: "arkhe-live-2026-11-03-markhe-weapon.json", who: "Markhe (#8, weapon)", ci: 8, game: "16310~22776" },
  { file: "arkhe-live-2026-11-03-markhe-noweapon.json", who: "Markhe (#8, no weapon)", ci: 8, game: "13013~18171" },
  { file: "arkhe-live-2026-11-03-farkhe.json", who: "farkhe (#3, Arcane Cultist)", ci: 3, game: "47604339~86857861" },
];

const minMax = ({ file, ci }: Reading): [number, number] => {
  const r = computeArkhDamage(JSON.parse(readFileSync(DIR + file, "utf8")), ci, 150);
  const mastery = r.tree.children!.find((c) => c.name === "Mastery (Min)")!.val;
  return [r.total * mastery, r.total];
};

describe.skipIf(!READINGS.every((r) => existsSync(DIR + r.file)))("Max damage matches the in-game Player Info", () => {
  // farkhe's 8 digits sit ~4e-6 under the game: Artifacts 2 and 8's slab and
  // build-speed factors aren't ported.
  it.each(READINGS)("$who: Damage reads $game", (r) => {
    const [min, max] = minMax(r);
    const [gMin, gMax] = r.game.split("~").map(Number);
    if (gMax < 1e6) {
      expect(`${Math.ceil(min / 1e30)}~${Math.ceil(max / 1e30)}`).toBe(r.game);
    } else {
      expect(Math.abs(max / 1e30 / gMax - 1)).toBeLessThan(1e-5);
      expect(Math.abs(min / 1e30 / gMin - 1)).toBeLessThan(1e-5);
    }
  });
});
