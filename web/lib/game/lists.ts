import { attr } from "./attr";
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
