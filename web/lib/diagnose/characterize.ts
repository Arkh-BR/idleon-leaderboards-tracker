// Characterization of a lib/game tracker over the real saves: the tracker runs on every character of every save, and each pair comes back
// as a row: its total, or the error it threw, and the trace's flagged leaves (`runtime:` / `assumed:` notes, values the save cannot give,
// lib/game/trace.ts). `classify` then says what the row is: clean, flagged, a pre-migration refusal (Ruling E) or an error. The engine is
// any `(save, ci) => StatResult`, so this serves every tracker; the CLI is scripts/characterize.ts.
// (It used to compare lib/game against lib/arkh pair by pair; lib/arkh is gone, the game's own readings are the check now:
// __tests__/readings/readings.save.test.ts, scripts/verify-map.ts.)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CURRENT_CSVER, UNPORTED_STEPS } from "@/lib/game/errors";
import type { StatResult } from "@/lib/statTracker/config";

export type Engine = (save: unknown, ci: number) => StatResult;
export type Err = { name: string; message: string };
type Node = StatResult["tree"];

/** One (save, character) pair: the total, or what the engine threw. */
export type Row = {
  save: string;
  ci: number;
  total?: number;
  err?: Err;
  /** The tree's nodes with a `runtime:` or `assumed:` note. */
  flagged: Flagged[];
};

/** A flagged node: its name, its note and its path from the root (the node names joined by " / "). */
export type Flagged = { leaf: string; note: string; path: string };

export type Characterization = {
  rows: Row[];
  /** Time spent inside the engine over all pairs, in ms (parsing the saves is not counted). */
  ms: number;
};

const errOf = (e: unknown): Err => (e instanceof Error ? { name: e.name, message: e.message } : { name: "Error", message: String(e) });

/** The `n` most recently modified of these save paths, newest first (the newest data). */
export const newestSaves = (saves: string[], n: number): string[] => [...saves].sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs).slice(0, n);

function readEnvelope(path: string): { charNames: unknown[] } {
  const save = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(save?.charNames) || save.data === null || typeof save.data !== "object") throw new Error(`${path}: not a save envelope`);
  return save;
}

const isEnvelope = (path: string): boolean => {
  try {
    readEnvelope(path);
    return true;
  } catch {
    return false; // not JSON, or not an envelope (golden/.cache also holds other captures)
  }
};

/**
 * The save envelopes in the two real-save folders under `web` (scripts/updater/golden/.cache, scripts/updater/.cache/saves-fresh, both
 * gitignored): their top-level `*.json` files that are envelopes, sorted. A missing folder gives nothing.
 */
export const realSaves = (web: string): string[] =>
  ["scripts/updater/golden/.cache", "scripts/updater/.cache/saves-fresh"]
    .map((d) => join(web, d))
    .flatMap((dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)) : []))
    .filter(isEnvelope)
    .sort();

/** The nodes of `tree` whose note is `runtime:` or `assumed:` (trackers/page.ts keeps them in the page's tree, Ruling L). */
export function flaggedLeaves(tree: Node): Flagged[] {
  const out: Flagged[] = [];
  const walk = (n: Node, path: string) => {
    const at = path ? `${path} / ${n.name}` : n.name;
    if (n.note && /^(runtime|assumed):/.test(n.note)) out.push({ leaf: n.name, note: n.note, path: at });
    for (const c of n.children ?? []) walk(c, at);
  };
  walk(tree, "");
  return out;
}

/** Runs `engine` on every character of every save in `saves` (paths of envelopes), each on its own parse of the save. Only the engine calls are timed. */
export function characterize(saves: string[], engine: Engine): Characterization {
  const rows: Row[] = [];
  let ms = 0;
  for (const path of saves) {
    const n = readEnvelope(path).charNames.length;
    for (let ci = 0; ci < n; ci++) {
      const save = readEnvelope(path);
      const t0 = performance.now();
      try {
        const r = engine(save, ci);
        ms += performance.now() - t0;
        rows.push({ save: path, ci, total: r.total, flagged: flaggedLeaves(r.tree) });
      } catch (e) {
        ms += performance.now() - t0;
        rows.push({ save: path, ci, err: errOf(e), flagged: [] });
      }
    }
  }
  return { rows, ms };
}

/**
 * clean: a finite total and no flagged leaf; flagged: a finite total that counts a value the save cannot give (its leaves say which);
 * refused: MissingSaveKey on a pre-migration save (for a key the stat may be refused for), which the game itself migrates on load
 * (Ruling E); error: anything else (another error, a refusal on a current save, a non-finite total).
 */
export type Verdict = "clean" | "flagged" | "refused" | "error";

/** The key a refusal names: the message up to the first colon or line break. */
export const refusedKey = (e: Err): string => e.message.split(/[:\n]/)[0];

const REFUSALS = new Set(["MissingSaveKey"]);

/**
 * The keys an older save may be refused for by Artifact Find (`classify`'s `refusable`): lib/game replays the game's load steps on an older
 * save (lib/game/migrations), so the only refusal left is a save older than the steps ported. Any other missing key on an old save is a
 * gap, not age. The tracker test checks it against the refusals it pins.
 */
export const ARTIFACT_FIND_REFUSABLE = (key: string): boolean => key === UNPORTED_STEPS;

/**
 * Damage's list: Artifact Find's. The stats Damage reads carry Tome bubbles, and the Tome is lib/game's own (DNSM.TomeQTYtot), refused for
 * the same keys as everything else. The tracker test checks it against the refusals it pins.
 */
export const DAMAGE_REFUSABLE = ARTIFACT_FIND_REFUSABLE;

/** AFK Gains' list: Damage's (the AFK pools read the same Tome-scored bubbles and an older save's steps). */
export const AFK_REFUSABLE = DAMAGE_REFUSABLE;

/** EXP Multi's list: Damage's too (the talents read the Tome-scored bubbles). */
export const EXP_REFUSABLE = DAMAGE_REFUSABLE;

/** Drop Rate V2's list: Damage's too (the DR reads the Tome-scored sources). */
export const DR_REFUSABLE = DAMAGE_REFUSABLE;

/** Coin Multi's list: Damage's too (the block's first read, TotalStats("STR"), carries the Tome bubbles). */
export const COIN_REFUSABLE = DAMAGE_REFUSABLE;

/** Multikill's list: Damage's too (the tier reads DamageDealed("Max")). */
export const MULTIKILL_REFUSABLE = DAMAGE_REFUSABLE;

/**
 * `csver` is the save's `data.CSver`. `refusable` (default: any key) says which keys the stat may be refused for; a refusal for another
 * key is a gap, not age, so it is an error. The key is what `MissingSaveKey` carries.
 */
export function classify(row: Row, csver: number | undefined, refusable: (key: string) => boolean = () => true): Verdict {
  if (row.err) {
    const refused = REFUSALS.has(row.err.name) && csver !== undefined && csver < CURRENT_CSVER && refusable(refusedKey(row.err));
    return refused ? "refused" : "error";
  }
  if (!Number.isFinite(row.total)) return "error";
  return row.flagged.length ? "flagged" : "clean";
}
