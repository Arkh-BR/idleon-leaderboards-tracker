import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Reading } from "./types";

// Paths are relative to web/ (the cwd of vitest and `npx tsx`).
export const READINGS_DIR = "scripts/updater/golden/.cache/readings/"; // private saves, gitignored
export const READINGS_INDEX = "fixtures/readings.json"; // metadata only, committed

export function loadReadings(index = READINGS_INDEX): Reading[] {
  return existsSync(index) ? (JSON.parse(readFileSync(index, "utf8")) as Reading[]) : [];
}

/** The envelope captured with the reading, or null when the private file is absent. */
export function readingSave(r: Reading, dir = READINGS_DIR): unknown | null {
  const file = join(dir, r.saveFile);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}
