// Strict mode (spec, "Modo estrito"): the engine never answers a missing or broken
// save value with 0. It throws one of these, carrying the save address.

/** A save key, or an index inside it, is absent. `key` is the full address, e.g. `Lv0_3[0]`. */
export class MissingSaveKey extends Error {
  readonly key: string;
  constructor(key: string) {
    super(key);
    this.name = "MissingSaveKey";
    this.key = key;
  }
}

/** The address exists but holds something the caller cannot use (NaN, a string where a number is needed). */
export class InvalidSaveValue extends Error {
  readonly key: string;
  constructor(key: string, expected: string, got: unknown) {
    super(`${key}: expected ${expected}, got ${describe(got)}`);
    this.name = "InvalidSaveValue";
    this.key = key;
  }
}

function describe(v: unknown): string {
  if (typeof v === "number") return String(v); // NaN / Infinity / a finite number in the wrong place
  if (typeof v === "string") return `string ${JSON.stringify(v.length > 40 ? `${v.slice(0, 40)}...` : v)}`;
  if (Array.isArray(v)) return "array";
  return v === null ? "null" : typeof v;
}

/**
 * NaN or Infinity where `block` needs a finite number: in the value a mirrored N.js
 * function returned (`got` is that value), or in a numeric argument (`inArg`), which
 * would also collapse to `null` in the cache key. Never cached, never passed on.
 */
export class NonFiniteResult extends Error {
  readonly block: string;
  readonly args: readonly unknown[];
  constructor(block: string, args: readonly unknown[], got: number, inArg = false) {
    super(
      inArg
        ? `${block}(${JSON.stringify(args)}) called with a non-finite argument (${got})`
        : `${block}(${JSON.stringify(args)}) returned ${got}`
    );
    this.name = "NonFiniteResult";
    this.block = block;
    this.args = args;
  }
}
