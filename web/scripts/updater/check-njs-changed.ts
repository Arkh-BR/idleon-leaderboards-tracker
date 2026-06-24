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

/** Pure decision: changed when there is no baseline etag or it differs. */
export function etagChanged(baselineEtag: string | null | undefined, liveEtag: string | null): boolean {
  const base = normalizeEtag(baselineEtag);
  if (!base) return true; // no baseline yet → force one processing run
  return base !== normalizeEtag(liveEtag);
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
