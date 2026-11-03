// GameState: the save, parsed once, deep-frozen, with strict accessors.
// No module-level state; every function takes the state it reads.
//
// Accessor address syntax: `(key, ...idx)` reads `data[key][idx0][idx1]...`.
// An address is written `key[idx0][idx1]` in errors, e.g. `num(state, "Lv0_3", 0)`
// reads `data["Lv0_3"][0]` and a miss reports `MissingSaveKey: Lv0_3[0]`.
// A `null` anywhere on the path counts as absent (the save uses null for "empty").
import type { SaveEnvelope } from "@/lib/gameAuth/envelope";
import { InvalidSaveValue, MissingSaveKey } from "./errors";

/** The slice of the save envelope the engine reads. */
export type GameEnvelope = Pick<
  SaveEnvelope,
  "data" | "charNames" | "companion" | "guildData" | "serverVars"
>;

type Idx = string | number;

export class GameState {
  readonly data: Readonly<Record<string, unknown>>;
  readonly charNames: readonly string[];
  readonly serverVars: Readonly<Record<string, unknown>> | null;
  readonly companion: unknown;
  readonly guildData: Readonly<GameEnvelope["guildData"]>;

  /** Use `buildGameState`. */
  constructor(parts: Pick<GameState, "data" | "charNames" | "serverVars" | "companion" | "guildData">) {
    this.data = parts.data;
    this.charNames = parts.charNames;
    this.serverVars = parts.serverVars;
    this.companion = parts.companion;
    this.guildData = parts.guildData;
    Object.freeze(this);
  }

  /** A whole save key. Throws `MissingSaveKey` when absent. */
  get(key: string): unknown {
    const v = lookup(this, key, []);
    if (v === undefined) throw new MissingSaveKey(key);
    return v;
  }
}

/** Freezes in place. Only ever called on values this module created or cloned. */
function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
    for (const child of Object.values(v)) deepFreeze(child);
    Object.freeze(v);
  }
  return v;
}

/** A frozen private copy: the caller's envelope stays mutable (the old engine writes into it). */
const frozenCopy = <T>(v: T): T =>
  deepFreeze(v !== null && typeof v === "object" ? structuredClone(v) : v);

/**
 * `data` values are often JSON strings (`"EquipOrder_8": "[...]"`). Only strings
 * that look like an array/object are parsed; any other string (`"mushG"`,
 * `"8,_,_,"`, even `"123"`) is the save's own text and stays a string.
 */
function parseSaveValue(v: unknown): unknown {
  if (typeof v !== "string") return frozenCopy(v);
  if (v[0] !== "[" && v[0] !== "{") return v;
  try {
    return deepFreeze(JSON.parse(v));
  } catch {
    return v; // looked like JSON, is not; the accessors will refuse it as a number
  }
}

export function buildGameState(env: GameEnvelope): GameState {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(env.data)) data[k] = parseSaveValue(v);
  return new GameState({
    data: Object.freeze(data),
    charNames: frozenCopy(env.charNames),
    serverVars: frozenCopy(env.serverVars),
    companion: frozenCopy(env.companion),
    guildData: frozenCopy(env.guildData),
  });
}

/** The per-character save key: `charKey("EquipOrder", 8)` is `EquipOrder_8`. */
export const charKey = (key: string, ci: number): string => `${key}_${ci}`;

const address = (key: string, idx: readonly Idx[]): string => key + idx.map((i) => `[${i}]`).join("");

/**
 * `undefined` = absent. Own properties only (no prototype chain, no `array.length`),
 * and only through objects/arrays: indexing into a string would silently yield a character.
 */
function lookup(state: GameState, key: string, idx: readonly Idx[]): unknown {
  let cur: unknown = state.data;
  for (const step of [key, ...idx]) {
    if (cur === null || typeof cur !== "object" || !Object.hasOwn(cur, step)) return undefined;
    if (Array.isArray(cur) && typeof step !== "number") return undefined; // `length`, not an element
    cur = (cur as Record<Idx, unknown>)[step];
  }
  return cur ?? undefined;
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

/** The explicit "may be absent" accessor: the value, or `undefined` when the address is absent. */
export function opt(state: GameState, key: string, ...idx: Idx[]): unknown {
  return lookup(state, key, idx);
}
