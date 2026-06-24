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

/** Normalizes an HTTP ETag for comparison: strips the optional weak-validator
 *  prefix (`W/`) and surrounding whitespace, so a weak `W/"abc"` and a strong
 *  `"abc"` for the same content compare equal. nginx returns a WEAK etag for
 *  gzip-compressed responses — which is exactly what `fetch` gets by default —
 *  so without this a weak/strong flip would falsely read as "changed". */
export function normalizeEtag(e: string | null | undefined): string | null {
  if (!e) return null;
  return e.replace(/^\s*W\//i, "").trim();
}

export type FetchedNjs = { text: string; sha256: string; byteLength: number; etag: string | null };

/** Downloads the live N.js to `destPath` and returns its text + hash + etag. */
export async function fetchNjs(destPath: string): Promise<FetchedNjs> {
  const res = await fetch(NJS_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`fetch N.js failed: HTTP ${res.status} ${res.statusText}`);
  }
  const etag = res.headers.get("etag");
  const text = await res.text();
  if (text.length < 1_000_000) {
    throw new Error(`downloaded N.js looks wrong: only ${text.length} bytes`);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, text, "utf8");
  return { text, sha256: sha256(text), byteLength: Buffer.byteLength(text, "utf8"), etag };
}

export type NjsHead = { etag: string | null; lastModified: string | null; byteLength: number | null };

/** Cheap change-probe: reads the server's ETag/Last-Modified without downloading
 *  the ~25 MB body. The ETag changes whenever the bundle's mtime/size changes. */
export async function headNjs(): Promise<NjsHead> {
  const res = await fetch(NJS_URL, { method: "HEAD", redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HEAD N.js failed: HTTP ${res.status} ${res.statusText}`);
  }
  const cl = res.headers.get("content-length");
  return {
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    byteLength: cl ? Number(cl) : null,
  };
}
