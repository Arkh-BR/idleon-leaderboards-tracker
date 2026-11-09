// Characterization of two engines of the same stat (spec, "Critérios pra trocar um tracker"): both run on every
// character of every save, and the pairs that differ, or where one of them throws, come back as rows. A row is
// then explained by `classify` (an entry of the oracle's known-diff list, a pre-migration refusal, a shared error)
// or it is unexplained, which blocks the switch. The engines are any two `(save, ci) => StatResult`, so this is
// reusable by the next tracker; the CLI is scripts/characterize.ts.
import { readFileSync, statSync } from "node:fs";
import { CURRENT_CSVER, UNPORTED_STEPS } from "@/lib/game/errors";
import type { StatResult } from "@/lib/statTracker/config";

export type Engine = (save: unknown, ci: number) => StatResult;
export type Err = { name: string; message: string };

/** One pair that differs (relative > 1e-9, or a non-finite number) or where an engine threw. `a`/`b` are the totals. */
export type Row = {
  save: string;
  ci: number;
  a?: number;
  b?: number;
  rel?: number;
  /** What `a` / `b` threw. */
  errA?: Err;
  errB?: Err;
  /** `errA` / `errB` as one line: "b threw MissingSaveKey: Menagerie". */
  error?: string;
};

export type Characterization = {
  rows: Row[];
  /** The (save, character) pairs run. */
  pairs: number;
  /** Time spent inside each engine over all pairs, in ms (parsing the saves is not counted). */
  msA: number;
  msB: number;
};

const REL = 1e-9;
const relDiff = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)));
const errOf = (e: unknown): Err => (e instanceof Error ? { name: e.name, message: e.message } : { name: "Error", message: String(e) });

/** The `n` most recently modified of these save paths, newest first (the newest data). */
export const newestSaves = (saves: string[], n: number): string[] => [...saves].sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs).slice(0, n);

function readEnvelope(path: string): { charNames: unknown[] } {
  const save = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(save?.charNames) || save.data === null || typeof save.data !== "object") throw new Error(`${path}: not a save envelope`);
  return save;
}

/**
 * Runs `a` and `b` on every character of every save in `saves` (paths of envelopes). Each engine gets its own parse of
 * the save, so one that writes into it cannot change the other's answer. Only the engine calls are timed.
 */
export function characterize(saves: string[], a: Engine, b: Engine): Characterization {
  const rows: Row[] = [];
  let pairs = 0;
  let msA = 0;
  let msB = 0;
  const call = (engine: Engine, save: unknown, ci: number): { total: number; ms: number } | { err: Err; ms: number } => {
    const t0 = performance.now();
    try {
      const total = engine(save, ci).total;
      return { total, ms: performance.now() - t0 };
    } catch (e) {
      return { err: errOf(e), ms: performance.now() - t0 };
    }
  };
  for (const path of saves) {
    const forA = readEnvelope(path);
    const forB = readEnvelope(path);
    for (let ci = 0; ci < forA.charNames.length; ci++) {
      pairs++;
      const ra = call(a, forA, ci);
      const rb = call(b, forB, ci);
      msA += ra.ms;
      msB += rb.ms;
      if ("err" in ra || "err" in rb) {
        const errA = "err" in ra ? ra.err : undefined;
        const errB = "err" in rb ? rb.err : undefined;
        const says = (side: string, e?: Err) => (e ? [`${side} threw ${e.name}: ${e.message}`] : []);
        rows.push({
          save: path,
          ci,
          ...("total" in ra && { a: ra.total }),
          ...("total" in rb && { b: rb.total }),
          ...(errA && { errA }),
          ...(errB && { errB }),
          error: [...says("a", errA), ...says("b", errB)].join("; "),
        });
        continue;
      }
      const rel = relDiff(ra.total, rb.total);
      if (!(rel <= REL)) rows.push({ save: path, ci, a: ra.total, b: rb.total, rel });
    }
  }
  return { rows, pairs, msA, msB };
}

/**
 * known: the oracle's diff list names this save and character (N.js evidence there); refused: lib/game (`b`) throws
 * MissingSaveKey on a pre-migration save (for a key the stat may be refused for), which the game itself migrates on load (Ruling E); shared: both engines throw;
 * unexplained: anything else, which blocks the switch.
 */
export type Verdict = "known" | "refused" | "shared" | "unexplained";

/** The key a refusal names: the message up to the first colon or line break (`Tome rows 107,108: #107 ...` is `Tome rows 107,108`). */
export const refusedKey = (e: Err): string => e.message.split(/[:\n]/)[0];

const REFUSALS = new Set(["MissingSaveKey", "IncompleteTome"]); // IncompleteTome is a MissingSaveKey (lib/game/errors.ts)

/**
 * The keys an older save may be refused for by Artifact Find (`classify`'s `refusable`): lib/game replays the game's load steps on an older
 * save (lib/game/migrations), so the only refusal left is a save older than the steps ported. Any other missing key on an old save is a
 * gap, not age. The tracker test checks it against the refusals it pins.
 */
export const ARTIFACT_FIND_REFUSABLE = (key: string): boolean => key === UNPORTED_STEPS;

/**
 * Damage's list: Artifact Find's, plus a Tome lib/tome cannot score on an older save (IncompleteTome, key `Tome rows <ids>`). The stats
 * Damage reads carry Tome bubbles (Ruling K: the Tome stays lib/tome's until it moves to lib/game). The tracker test checks it against
 * the refusals it pins.
 */
export const DAMAGE_REFUSABLE = (key: string): boolean => ARTIFACT_FIND_REFUSABLE(key) || /^Tome rows \d+(,\d+)*$/.test(key);

/** AFK Gains' list: Damage's (the AFK pools read the same Tome-scored bubbles and an older save's steps). */
export const AFK_REFUSABLE = DAMAGE_REFUSABLE;

/** EXP Multi's list: Damage's too (the talents read the Tome-scored bubbles; HourZero is refused for its Tome rows, Ruling E). */
export const EXP_REFUSABLE = DAMAGE_REFUSABLE;

/** Drop Rate V2's list: Damage's too (the DR reads the Tome-scored sources; HourZero is refused for its Tome rows, as for EXP). */
export const DR_REFUSABLE = DAMAGE_REFUSABLE;

/** Coin Multi's list: Damage's too (the block's first read, TotalStats("STR"), carries the Tome rows HourZero is refused for). */
export const COIN_REFUSABLE = DAMAGE_REFUSABLE;

/** Multikill's list: Damage's too (the tier reads DamageDealed("Max"), whose Tome rows HourZero is refused for, Ruling E). */
export const MULTIKILL_REFUSABLE = DAMAGE_REFUSABLE;

/**
 * `known` is the oracle's KNOWN_ARKH_DIFFS ({save: file name, ci?: omitted = every character}); `csver` is the save's `data.CSver`.
 * A diff-list entry explains a difference of numbers only, never an error, and only the `b` (lib/game) side can refuse.
 * `refusable` (default: any key) says which keys the stat may be refused for; a refusal for another key is a gap, not age, so it is
 * unexplained. The key is what `MissingSaveKey` carries, or what comes before the colon in an IncompleteTome message.
 */
export function classify(
  row: Row,
  known: readonly { save: string; ci?: number }[],
  csver: number | undefined,
  refusable: (key: string) => boolean = () => true
): Verdict {
  if (row.errA && row.errB) return "shared";
  if (row.errA) return "unexplained"; // lib/arkh fails where lib/game answers: nothing explains that yet
  if (row.errB) {
    const refused = REFUSALS.has(row.errB.name) && csver !== undefined && csver < CURRENT_CSVER && refusable(refusedKey(row.errB));
    return refused ? "refused" : "unexplained";
  }
  const file = row.save.split(/[\\/]/).pop();
  return known.some((d) => d.save === file && (d.ci ?? row.ci) === row.ci) ? "known" : "unexplained";
}
