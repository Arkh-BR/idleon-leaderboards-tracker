import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProfileSave, gatherCandidates } from "../../_shared/itProfiles";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, ".cache");
// A cached profile is re-fetched after this many days. The embedded reference
// (parsedData) is computed by idleontoolbox.com when the player uploads, so a
// cache that outlives a game update keeps validating against a pre-update
// parser (2026-09: 118-task tome layouts and stage-1 companion values read as
// phantom mismatches). GOLDEN_REFRESH=1 forces a re-fetch of everything.
const MAX_AGE_DAYS = 7;

/** ARKHE + a small set of diverse top players (DR + Tome boards). */
export async function referenceProfiles(limit = 6): Promise<string[]> {
  const names = new Set<string>(["ARKHE"]);
  for (const board of ["dropRate", "totalTomePoints"]) {
    for (const n of await gatherCandidates({ focusBoard: board, limit })) names.add(n);
  }
  return [...names];
}

/** Fetch a save, using the on-disk cache while it is younger than MAX_AGE_DAYS.
 *  Falls back to a stale cache when the API fails. Returns null when neither exists. */
export async function getSave(name: string, useCache = true): Promise<any | null> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${name}.json`);
  const cached = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  const ageMs = cached ? Date.now() - statSync(path).mtimeMs : Infinity;
  if (useCache && cached && ageMs < MAX_AGE_DAYS * 864e5 && !process.env.GOLDEN_REFRESH) return cached;
  const save = await fetchProfileSave(name);
  if (save) {
    writeFileSync(path, JSON.stringify(save), "utf8");
    return save;
  }
  return cached;
}
