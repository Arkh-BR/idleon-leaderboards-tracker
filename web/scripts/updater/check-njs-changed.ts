// Cheap N.js change gate for the update-watch workflow. Reads the live ETag via
// a HEAD request (no ~25 MB download) and compares it to the committed baseline
// in meta.json. Emits `changed=true|false` (+ the live etag) to $GITHUB_OUTPUT.
// Always exits 0 — the workflow decides what to do with the output.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { headNjs, normalizeEtag } from "./fetch-njs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const META = resolve(__dirname, "../../data/njs-snapshot/meta.json");

function setOutput(key: string, val: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${key}=${val}\n`);
}

// The game is served from GitHub Pages, whose ETag is "<mtime hex>-<size hex>".
// Its origin replicas hold the same file with mtimes a second apart, so the
// SAME bytes come back as "6aad6d41-18f8a15" from one POP and
// "6aad6d42-18f8a15" from another (2026-09-18: the CI runner and the baseline
// saw different replicas → a "clean" PR whose only change was the etag, which
// then blocked real detection through the open-PR guard). Same size + mtimes
// within this window = the same deploy. A real update landing within five
// minutes of the previous one AND byte-identical in size is not a thing.
const MIRROR_SKEW_S = 300;

function parseMtimeSize(etag: string | null): { mtime: number; size: number } | null {
  const m = /^"?([0-9a-f]+)-([0-9a-f]+)"?$/i.exec(etag ?? "");
  return m ? { mtime: parseInt(m[1], 16), size: parseInt(m[2], 16) } : null;
}

/** Pure decision: changed when there is no baseline etag or it differs —
 *  ignoring the W/ prefix and replica mtime skew (see MIRROR_SKEW_S). */
export function etagChanged(baselineEtag: string | null | undefined, liveEtag: string | null): boolean {
  const base = normalizeEtag(baselineEtag);
  if (!base) return true; // no baseline yet → force one processing run
  const live = normalizeEtag(liveEtag);
  if (base === live) return false;
  const a = parseMtimeSize(base);
  const b = parseMtimeSize(live);
  if (a && b && a.size === b.size && Math.abs(a.mtime - b.mtime) <= MIRROR_SKEW_S) return false;
  return true;
}

async function main(): Promise<void> {
  const head = await headNjs();
  const meta = existsSync(META) ? JSON.parse(readFileSync(META, "utf8")) : {};
  const baselineEtag: string | null = meta.etag ?? null;
  const changed = etagChanged(baselineEtag, head.etag);
  console.log(
    `[check] live etag=${head.etag} lastMod=${head.lastModified} | ` +
      `baseline etag=${baselineEtag ?? "(none)"} → ${changed ? "CHANGED" : "unchanged"}`,
  );
  setOutput("changed", changed ? "true" : "false");
  setOutput("etag", head.etag ?? "");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error("[check] ERRO:", (e as Error).message);
    // Network hiccup → treat as "no change" so we don't open a broken PR.
    setOutput("changed", "false");
    process.exit(0);
  });
}
