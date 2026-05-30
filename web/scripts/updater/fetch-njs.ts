// ===== Idleon updater — N.js downloader =====
// Fetches the LIVE game bundle and reports its hash so the orchestrator can
// skip work when nothing changed.

import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const NJS_URL = "https://www.legendsofidleon.com/ytGl5oc/N.js";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export type FetchedNjs = { text: string; sha256: string; byteLength: number };

/** Downloads the live N.js to `destPath` and returns its text + hash. */
export async function fetchNjs(destPath: string): Promise<FetchedNjs> {
  const res = await fetch(NJS_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`fetch N.js failed: HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (text.length < 1_000_000) {
    // The real bundle is ~25 MB; anything tiny is an error page, not the game.
    throw new Error(`downloaded N.js looks wrong: only ${text.length} bytes`);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, text, "utf8");
  return { text, sha256: sha256(text), byteLength: Buffer.byteLength(text, "utf8") };
}
