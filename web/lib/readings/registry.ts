import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Reading, StatKey } from "./types";

// Anchored to web/ (this file is web/lib/readings), never to the cwd: run from the repo root, a
// cwd-relative READINGS_DIR would write a private save where nothing gitignores it.
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const READINGS_DIR = join(WEB, "scripts/updater/golden/.cache/readings"); // private saves, gitignored
export const READINGS_INDEX = join(WEB, "fixtures/readings.json"); // metadata only, committed

export function loadReadings(index = READINGS_INDEX): Reading[] {
  return existsSync(index) ? (JSON.parse(readFileSync(index, "utf8")) as Reading[]) : [];
}

/** The envelope captured with the reading, or null when the private file is absent. */
export function readingSave(r: Reading, dir = READINGS_DIR): unknown | null {
  const file = join(dir, r.saveFile);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** Every value the game showed for the reading: its main stat, then each `extra` (keyed by StatKey). */
export function readingValues(r: Reading): { stat: StatKey; game: string }[] {
  return Object.entries({ [r.stat]: r.game, ...r.extra }).map(([stat, game]) => ({ stat: stat as StatKey, game }));
}
