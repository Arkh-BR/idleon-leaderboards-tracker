// The real saves the lib/game tests loop over (a support module: vitest only collects *.test.ts).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

const WEB = resolve(__dirname, "../../../..");

const DEFAULT_DIRS = ["scripts/updater/golden/.cache", "scripts/updater/.cache/saves-fresh"];

// A save envelope has a `charNames` array and a `data` object. The folders are mixed drop folders
// (golden/.cache also has `readings/` and other captures), so anything else is not a save.
function isEnvelope(path: string): boolean {
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(j?.charNames) && j.data !== null && typeof j.data === "object";
  } catch {
    return false; // not JSON at all
  }
}

/**
 * The save envelopes in `dirs` (default: the two real-save folders): the top-level `*.json` files that
 * parse to an envelope, as absolute paths, sorted. Subfolders (`readings/`) and any other JSON are left
 * out. A missing folder contributes nothing. Costs one JSON.parse per file, so about 0.5 s for the 106
 * real saves. `GOLDEN_ONLY=a.json,b.json` in the environment keeps only the saves named (a check on a few saves, never the corpus; the
 * count assertions of a corpus test then fail by design).
 */
export function goldenSaves(dirs: string[] = DEFAULT_DIRS): string[] {
  const only = process.env.GOLDEN_ONLY?.split(",").filter(Boolean);
  if (!only?.length) return goldenSavesIn(dirs).filter((p) => !PARITY_EXCLUDED.includes(basename(p)));
  return goldenSavesIn(dirs).filter((p) => only.includes(basename(p)));
}

/**
 * The saves left out of the default corpus (GOLDEN_ONLY can still name them). HourZero (CSver 23) was left out of the old lib/arkh
 * parity corpus, and the corpus counts the real-save suites pin were taken without it.
 */
export const PARITY_EXCLUDED: readonly string[] = ["HourZero.json"];

function goldenSavesIn(dirs: string[]): string[] {
  return dirs
    .map((d) => resolve(WEB, d))
    .flatMap((dir) =>
      existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)) : []
    )
    .filter(isEnvelope)
    .sort();
}

/**
 * Every real save envelope on this machine: `goldenSaves()` over `scripts/updater/golden/.cache` and
 * `scripts/updater/.cache/saves-fresh`. Both folders are gitignored, so this is `[]` when they are absent
 * (CI): tests that use it must `describe.skipIf(GOLDEN_SAVES.length === 0)`. Six names appear in both
 * folders with identical content (ARKHE, Arlong, ...), so those saves are listed twice.
 */
export const GOLDEN_SAVES: string[] = goldenSaves();

/**
 * What every lib/game loop over the real saves refuses (Ruling E), as `<file>: <key>`, sorted: nothing. The game's load steps are
 * replayed on an older save (lib/game/migrations), back to the oldest real one (HourZero, DoOnceREAL 248.3); a save older than the
 * steps ported (DoOnceREAL < OLDEST_GATE) would be refused for every read, and no real save is.
 */
export const UNPORTED_REFUSALS: readonly string[] = [];

/** The lib/game Ctx for character `ci` of a parsed save, on map 0 (what Artifact Find uses). */
export const gameCtx = (save: unknown, ci: number, trace?: boolean): Ctx =>
  makeCtx(buildGameState(save as GameEnvelope), { player: ci, map: 0, trace });
