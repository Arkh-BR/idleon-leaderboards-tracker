// Strict mode (spec, "Modo estrito"): the engine never answers a missing or broken
// save value with 0. It throws one of these, carrying the save address.
//
// "Ruling A".."Ruling P" in the comments of lib/game are defined in the spec, section "Decisões da migração do Artifact Find (2026-11-04)":
// docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md.

/**
 * The save version (`data.CSver`) the N.js loader maps in full (Menagerie, Spelunk, Research...). A save below it is pre-migration:
 * the game migrates it on load. This engine replays the load steps Artifact Find needs (lib/game/migrations) and refuses, with a
 * MissingSaveKey (Ruling E), what they do not give.
 */
export const CURRENT_CSVER = 34.05;

/**
 * The oldest load block examined (lib/game/migrations): every block from here on is ported or accounted for at the end of that file. A
 * save below it would also run older blocks, which nothing there replays, so its state would be half migrated: it is refused. No real
 * save is. Kept here with CURRENT_CSVER so the page can tell the two apart without loading the engine.
 */
export const OLDEST_GATE = 248;

/** The refusal of a save below OLDEST_GATE (the page says it in words). */
export const UNPORTED_STEPS = `the game's load steps for DoOnceREAL < ${OLDEST_GATE}`;

/** A save key, or an index inside it, is absent. `key` is the full address, e.g. `Lv0_3[0]`. */
export class MissingSaveKey extends Error {
  readonly key: string;
  constructor(key: string) {
    super(key);
    this.name = "MissingSaveKey";
    this.key = key;
  }
}

/**
 * `computeTome` (lib/tome) could not compute some Tome rows because the save lacks what they read (a pre-migration save): a
 * MissingSaveKey, so it is refused like any other (Ruling E), whose key is the row numbers (`Tome rows 107,108,109`) and whose
 * message names each row and where it looked. A partial score would be a silent floor.
 */
export class IncompleteTome extends MissingSaveKey {
  readonly rows: readonly { idx: number; task: string; source: string }[];
  constructor(rows: readonly { idx: number; task: string; source: string }[]) {
    super(`Tome rows ${rows.map((r) => r.idx).join(",")}`);
    this.name = "IncompleteTome";
    this.rows = rows;
    this.message = `${this.key}: ${rows.map((r) => `#${r.idx} "${r.task}" (${r.source})`).join("; ")}`;
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

/**
 * `attr` was asked for a name the N.js loader does not load into an attribute (`SAVE_ATTRS`).
 * `why` says what to use instead when it is a known runtime-only attribute (`RUNTIME_ATTRS`).
 */
export class UnknownAttribute extends Error {
  readonly attribute: string;
  constructor(attribute: string, why?: string) {
    super(why ? `${attribute}: ${why}` : attribute);
    this.name = "UnknownAttribute";
    this.attribute = attribute;
  }
}

/**
 * A port reached a sub-case of an N.js function that it does not mirror (yet). One format for `sub`:
 *  - `"<Sub>"`: a named sub-case (`"VaultUpgBonus"`);
 *  - `"<Sub>:<arg>=<value>"`: an argument outside the ported set (`"VaultUpgBonus:b=5"`, `"Fountain_BonTOT:b=3,e=0"`); a function with
 *    no named sub-case says just `"<arg>=<value>"` (`"d=15"`);
 *  - `"<state>"`: a game-state condition (`"CurrentMap=41"`).
 */
export class NotPorted extends Error {
  readonly fn: string;
  readonly sub: string;
  constructor(fn: string, sub: string) {
    super(`${fn}: sub-case ${JSON.stringify(sub)} is not ported`);
    this.name = "NotPorted";
    this.fn = fn;
    this.sub = sub;
  }
}

/**
 * A tracker's tree does not add up to the number the engine computed (the page's groups, recombined, differ from the one call's total):
 * some term is computed twice and one copy is stale. There is no honest tree to show, so this is thrown instead of a pair that disagrees.
 */
export class TreeTotalMismatch extends Error {
  readonly total: number;
  readonly rebuilt: number;
  constructor(total: number, rebuilt: number) {
    super(`the groups give ${rebuilt}, the call ${total}`);
    this.name = "TreeTotalMismatch";
    this.total = total;
    this.rebuilt = rebuilt;
  }
}
