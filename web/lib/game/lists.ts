import { asNumber, attr } from "./attr";
import type { Ctx } from "./ctx";
import { InvalidSaveValue, MissingSaveKey } from "./errors";

/**
 * A list the game indexes into (`Spelunk[9][g]`): the game would throw a TypeError if the list were
 * not there, so the port refuses it too instead of reading every element as `asNumber(null) = 0`.
 * The elements are read afterwards with `asNum`, which keeps the trace.
 */
export function listAt(ctx: Ctx, name: string, ...idx: (string | number)[]): readonly unknown[] {
  const v = attr(ctx, name, ...idx);
  const address = name + idx.map((i) => `[${i}]`).join("");
  if (v === undefined) throw new MissingSaveKey(address);
  if (!Array.isArray(v)) throw new InvalidSaveValue(address, "an array", v);
  return v;
}

/**
 * N.js `D.contains(list, x)` @2160529: loose `==` against every element; a missing list contains nothing. The save keeps some
 * lists as `{"0": …}` maps, so an object is read by its values.
 */
export function contains(list: unknown, x: unknown): boolean {
  if (list == null) return false;
  const values: unknown[] = Array.isArray(list) ? list : Object.values(list as object);
  return values.some((v) => v == x);
}

/**
 * `listAt` for a list the save keeps either as an array or as a `{"0": …}` map (the cloud's sparse lists: `CauldronInfo[4]` is one).
 * The game's loader gives it back as a list; the elements are read with `asNum` as for any list, by their number.
 */
export function listOrMapAt(ctx: Ctx, name: string, ...idx: (string | number)[]): object {
  const v = attr(ctx, name, ...idx);
  const address = name + idx.map((i) => `[${i}]`).join("");
  if (v === undefined) throw new MissingSaveKey(address);
  if (v === null || typeof v !== "object") throw new InvalidSaveValue(address, "an array or a map", v);
  return v;
}

/** The game's `.length` of a list `listOrMapAt` gave: a `{"0": …}` map from the cloud keeps it under its own "length" key. */
export const lengthOf = (l: object): number => {
  if (Array.isArray(l)) return l.length;
  const n = (l as { length?: unknown }).length;
  if (n === undefined) throw new InvalidSaveValue("length", "a map with a \"length\" key", l);
  return asNumber(n);
};
