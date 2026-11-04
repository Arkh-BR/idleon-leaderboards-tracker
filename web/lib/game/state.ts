// GameState: the save, parsed once, deep-frozen, with strict accessors.
// No module-level state; every function takes the state it reads.
//
// Accessor address syntax: `(key, ...idx)` reads `data[key][idx0][idx1]...`.
// An address is written `key[idx0][idx1]` in errors, e.g. `num(state, "Lv0_3", 0)`
// reads `data["Lv0_3"][0]`.
//   - ABSENT (key/index not there, or a `null` on the path; the save uses null for
//     "empty"): `num`/`get` throw `MissingSaveKey`, `opt` returns `undefined`.
//   - PRESENT BUT THE WRONG SHAPE (stepping into a number/string, a string index on
//     an array, a corrupt JSON key, a non-number for `num`): always `InvalidSaveValue`,
//     `opt` included. `opt(...) ?? fallback` can therefore never hide bad data.
import type { SaveEnvelope } from "@/lib/gameAuth/envelope";
import { InvalidSaveValue, MissingSaveKey } from "./errors";

/** The save envelope. `extraData` is only stamped on some saves, so it is optional. */
export type GameEnvelope = Omit<SaveEnvelope, "extraData"> & {
  extraData?: Readonly<Record<string, unknown>>;
};

type Idx = string | number;

export class GameState {
  /** Every save key. JSON strings are parsed; null-prototype object, so `__proto__` is just a key. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Keys that looked like JSON (`[`/`{`) but did not parse: key -> the raw text. The accessors refuse them. */
  readonly corrupt: Readonly<Record<string, string>>;
  readonly charNames: readonly string[];
  readonly serverVars: Readonly<Record<string, unknown>> | null;
  readonly companion: unknown;
  readonly guildData: Readonly<GameEnvelope["guildData"]>;
  readonly tournament: Readonly<GameEnvelope["tournament"]>;
  readonly accountCreateTime: number;
  readonly lastUpdated: number;
  readonly extraData: Readonly<Record<string, unknown>> | undefined;

  /**
   * Validates the envelope, then builds a frozen private copy of it (the caller's
   * envelope stays mutable: the old engine writes into it). There is no way to
   * construct an unfrozen state. Top-level extras (e.g. `parsedData`) are ignored.
   */
  constructor(env: GameEnvelope) {
    if (!isObject(env)) throw new InvalidSaveValue("envelope", "an object", env);
    const e = env as Record<string, unknown>;
    const raw = field(e, "data", "an object", isRecord) as Record<string, unknown>;
    const data: Record<string, unknown> = Object.create(null);
    const corrupt: Record<string, string> = Object.create(null);
    for (const [k, v] of Object.entries(raw)) {
      const parsed = parseSaveValue(v);
      data[k] = parsed.value;
      if (parsed.corrupt) corrupt[k] = parsed.value as string;
    }
    this.data = Object.freeze(data);
    this.corrupt = Object.freeze(corrupt);
    this.charNames = frozenCopy(field(e, "charNames", "an array", Array.isArray)) as string[];
    this.companion = frozenCopy(field(e, "companion", "an object or null", () => true));
    this.guildData = frozenCopy(field(e, "guildData", "an object", isRecord)) as GameEnvelope["guildData"];
    this.serverVars = frozenCopy(
      field(e, "serverVars", "an object or null", (v) => v === null || isRecord(v))
    ) as Record<string, unknown> | null;
    this.tournament = frozenCopy(field(e, "tournament", "an object", isRecord)) as GameEnvelope["tournament"];
    this.accountCreateTime = field(e, "accountCreateTime", "a finite number", isFiniteNumber) as number;
    this.lastUpdated = field(e, "lastUpdated", "a finite number", isFiniteNumber) as number;
    const extra = e.extraData ?? undefined;
    if (extra !== undefined && !isRecord(extra)) throw new InvalidSaveValue("envelope.extraData", "an object", extra);
    this.extraData = frozenCopy(extra) as Record<string, unknown> | undefined;
    Object.freeze(this);
  }

  /** A whole save key. Throws `MissingSaveKey` when absent. */
  get(key: string): unknown {
    const v = lookup(this, key, []);
    if (v === undefined) throw new MissingSaveKey(key);
    return v;
  }
}

export const buildGameState = (env: GameEnvelope): GameState => new GameState(env);

const isObject = (v: unknown): v is object => v !== null && typeof v === "object";
const isRecord = (v: unknown): boolean => isObject(v) && !Array.isArray(v);
const isFiniteNumber = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);

/** A required envelope field: absent -> MissingSaveKey, wrong type -> InvalidSaveValue (both name `envelope.<field>`). */
function field(e: Record<string, unknown>, name: string, expected: string, ok: (v: unknown) => boolean): unknown {
  const v = e[name];
  if (v === undefined) throw new MissingSaveKey(`envelope.${name}`);
  if (!ok(v)) throw new InvalidSaveValue(`envelope.${name}`, expected, v);
  return v;
}

/** Freezes in place. Only ever called on values this module created or cloned. */
function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
    for (const child of Object.values(v)) deepFreeze(child);
    Object.freeze(v);
  }
  return v;
}

/** A frozen private copy of a caller-owned value. */
const frozenCopy = <T>(v: T): T =>
  deepFreeze(v !== null && typeof v === "object" ? structuredClone(v) : v);

/**
 * `data` values are often JSON strings (`"EquipOrder_8": "[...]"`). Only strings
 * that look like an array/object are parsed; any other string (`"mushG"`,
 * `"8,_,_,"`, even `"123"`) is the save's own text and stays a string. A string
 * that starts with `[`/`{` but does not parse is corrupt data: it is flagged so
 * the accessors refuse it instead of passing it off as a value or as absent.
 */
function parseSaveValue(v: unknown): { value: unknown; corrupt: boolean } {
  if (typeof v !== "string") return { value: frozenCopy(v), corrupt: false };
  if (v[0] !== "[" && v[0] !== "{") return { value: v, corrupt: false };
  try {
    return { value: deepFreeze(JSON.parse(v)), corrupt: false };
  } catch {
    return { value: v, corrupt: true };
  }
}

/** The per-character save key: `charKey("EquipOrder", 8)` is `EquipOrder_8`. */
export const charKey = (key: string, ci: number): string => `${key}_${ci}`;

const address = (key: string, idx: readonly Idx[]): string => key + idx.map((i) => `[${i}]`).join("");

/**
 * `undefined` = absent (own properties only: no prototype chain). Throws
 * `InvalidSaveValue` where the save HAS something there but it cannot be walked:
 * a corrupt key, a step into a non-container (indexing a string would silently
 * yield a character), or a string index on an array (`"0"`, `"length"`).
 */
function lookup(state: GameState, key: string, idx: readonly Idx[]): unknown {
  if (Object.hasOwn(state.corrupt, key)) {
    throw new InvalidSaveValue(key, "valid JSON", state.corrupt[key]);
  }
  const path = [key, ...idx];
  let cur: unknown = state.data;
  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    // `cur` is always an object/array here: state.data at i=0, checked below after.
    if (Array.isArray(cur) && typeof step !== "number") {
      throw new InvalidSaveValue(address(key, idx), `a numeric index into the array at ${address(key, idx.slice(0, i - 1))}`, step);
    }
    if (!Object.hasOwn(cur as object, step)) return undefined;
    cur = (cur as Record<Idx, unknown>)[step];
    if (cur === null || cur === undefined) return undefined;
    if (i < path.length - 1 && typeof cur !== "object") {
      throw new InvalidSaveValue(address(key, idx), `an array or object at ${address(key, idx.slice(0, i))}`, cur);
    }
  }
  return cur;
}

/** A finite number at the address. Throws `MissingSaveKey` if absent, `InvalidSaveValue` if not a finite number. */
export function num(state: GameState, key: string, ...idx: Idx[]): number {
  const v = lookup(state, key, idx);
  if (v === undefined) throw new MissingSaveKey(address(key, idx));
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new InvalidSaveValue(address(key, idx), "a finite number", v);
  }
  return v;
}

/** The explicit "may be absent" accessor: the value, or `undefined` when the address is absent. Wrong-shape data still throws. */
export function opt(state: GameState, key: string, ...idx: Idx[]): unknown {
  return lookup(state, key, idx);
}
