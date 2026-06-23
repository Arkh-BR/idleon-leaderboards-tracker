import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProfileSave, gatherCandidates } from "../../_shared/itProfiles";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, ".cache");

/** ARKHE + a small set of diverse top players (DR + Tome boards). */
export async function referenceProfiles(limit = 6): Promise<string[]> {
  const names = new Set<string>(["ARKHE"]);
  for (const board of ["dropRate", "totalTomePoints"]) {
    for (const n of await gatherCandidates({ focusBoard: board, limit })) names.add(n);
  }
  return [...names];
}

/** Fetch a save, using the on-disk cache when present. Returns null on failure. */
export async function getSave(name: string, useCache = true): Promise<any | null> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${name}.json`);
  if (useCache && existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const save = await fetchProfileSave(name);
  if (save) writeFileSync(path, JSON.stringify(save), "utf8");
  return save;
}
