// Usage (from web/): npx tsx scripts/readings/import.ts <bundle.json>…
// bundle = { reading: Omit<Reading, "saveFile" | "saveSha1">, envelope }
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { READINGS_DIR, READINGS_INDEX, loadReadings } from "../../lib/readings/registry";
import type { Reading } from "../../lib/readings/types";

export type Bundle = { reading: Omit<Reading, "saveFile" | "saveSha1">; envelope: unknown };

/** Writes the envelope to `dir/<id>.json` and upserts the metadata into `index`, sorted by id. */
export function importBundle(
  { reading, envelope }: Bundle,
  dir = READINGS_DIR,
  index = READINGS_INDEX,
): Reading {
  const json = JSON.stringify(envelope);
  if (json.includes("gameAuth.session")) throw new Error(`${reading.id}: envelope carries the session token`);
  const saveFile = `${reading.id}.json`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, saveFile), json);
  const entry: Reading = { ...reading, saveFile, saveSha1: createHash("sha1").update(json).digest("hex") };
  const all = loadReadings(index)
    .filter((r) => r.id !== entry.id)
    .concat(entry)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  mkdirSync(dirname(index), { recursive: true });
  writeFileSync(index, JSON.stringify(all, null, 2) + "\n");
  return entry;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const f of process.argv.slice(2)) {
    const r = importBundle(JSON.parse(readFileSync(f, "utf8")));
    console.log(`${r.id}  ${r.saveSha1}`);
  }
}
