// Which calls does the game's formula make that ours does not? The game's side is read off the
// N.js text (njsCalls), ours off a trace (traceCalls); callDiff says what differs. This would
// have caught Artifact 25 omitting its TotalStats call. A call is a block name plus its first
// argument when that is a lone literal (the "VaultUpgBonus" of Summoning("VaultUpgBonus",20,0)).
// The N.js text must be normalized (scripts/updater/extract.ts normalizeBundle).

import type { TraceNode } from "@/lib/game/trace";
import { readBody } from "@/scripts/updater/extract-formulas";

/** `args`: the literal arguments up to the first one that is not (arg0 is the first of them). */
export type Call = { block: string; arg0?: string | number; args?: (string | number)[] };

// `<receiver>._customBlock_X(`, or a bare `k.X(` with a PascalCase X (the engine's own helpers,
// c.asNumber and the like, are camelCase). The literal arguments are read after it (LITERAL_ARG).
const CALL_RE = /(?:_customBlock_([A-Za-z0-9_]+)|(?<![\w$.])[A-Za-z]\.([A-Z][A-Za-z0-9]*))\(/g;
const LITERAL_ARG = /(?:"((?:[^"\\]|\\.)*)"|(-?\d*\.?\d+))(?=[,)])/y;

/** Every call in a piece of N.js, one entry per call site, in source order. */
export function njsCalls(body: string): Call[] {
  return [...body.matchAll(CALL_RE)].map((m) => {
    const block = m[1] ?? m[2];
    const args: (string | number)[] = [];
    LITERAL_ARG.lastIndex = m.index + m[0].length;
    for (let a; (a = LITERAL_ARG.exec(body)); ) {
      args.push(a[1] ?? Number(a[2]));
      if (body[LITERAL_ARG.lastIndex] !== ",") break;
      LITERAL_ARG.lastIndex++;
    }
    return args.length ? { block, arg0: args[0], args } : { block };
  });
}

/**
 * Every call under `trace` (not the node itself), depth-first in call order, cached and threw
 * nodes included. Runtime and assumed values are not: they are not N.js calls, and one named after a
 * block would hide that the block's real call is missing. Nor are the `(absent)` leaves `asNum` leaves
 * for a `c.asNumber(null)` (an absent index read as 0): they stand for no N.js function.
 */
export function traceCalls(trace: TraceNode): Call[] {
  return trace.children.flatMap((n) => {
    if (n.note?.startsWith("runtime:") || n.note?.startsWith("assumed:") || n.note?.startsWith("absent:")) return [];
    const a = n.args[0];
    return [typeof a === "string" || typeof a === "number" ? { block: n.block, arg0: a } : { block: n.block }, ...traceCalls(n)];
  });
}

/** `TotalStats`, or `Summoning("VaultUpgBonus")`. */
export const callKey = (c: Call) => (c.arg0 === undefined ? c.block : `${c.block}(${JSON.stringify(c.arg0)})`);

const distinct = (cs: Call[]) => [...new Map(cs.map((c) => [callKey(c), c])).values()];

/**
 * What the game calls that we do not (`missing`) and what we call that the game does not
 * (`extra`), each call once. A game call with no literal argument is covered by any call of
 * that block; one with a literal argument only by the same argument. Static text against a
 * dynamic trace, so read it with care:
 * - `missing` can list calls in branches the trace did not take (another artifact, a false
 *   condition); the last numeric branch (njsNumericBranch) also includes the block's shared tail.
 * - `extra` also holds what our callees call (the text is one function, the trace is nested).
 */
export function callDiff(expected: Call[], actual: Call[]): { missing: Call[]; extra: Call[] } {
  const covers = (e: Call, a: Call) => e.block === a.block && (e.arg0 === undefined || e.arg0 === a.arg0);
  return {
    missing: distinct(expected.filter((e) => !actual.some((a) => covers(e, a)))),
    extra: distinct(actual.filter((a) => !expected.some((e) => covers(e, a)))),
  };
}

/**
 * `_customBlock_<name>`: its parameter names and its body (braces included). The same named
 * block ("UpgCost", "ArtifactBonus"…) can sit in several functions, so look inside the
 * function, not at the extractFormulas key. A name defined twice (GiveItem) gives the last,
 * as extractFormulas does.
 */
export function njsFunction(norm: string, name: string): { params: string[]; body: string } | undefined {
  const head = `_customBlock_${name}=function(`;
  const i = norm.lastIndexOf(head);
  if (i < 0) return undefined;
  const open = norm.indexOf("{", i);
  const body = readBody(norm, open)?.text;
  if (body === undefined) return undefined;
  return { params: norm.slice(i + head.length, norm.lastIndexOf(")", open)).split(",").filter(Boolean), body };
}

/** Index of the bracket that closes the one at `i` (string-aware); `s.length` if it never closes. */
function closeOf(s: string, i: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (quote) {
      if (c === "\\") k++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]" || c === "}") && --depth === 0) return k;
  }
  return s.length;
}

/**
 * End (exclusive) of the statement starting at `i`, for the shapes N.js gives a named block:
 * `{…}`, `for(…)stmt`, `while(…)stmt`, `if(…)stmt[else stmt]`, or an expression up to its `;`.
 */
function statementEnd(s: string, i: number): number {
  if (s[i] === "{") return Math.min(closeOf(s, i) + 1, s.length);
  const kw = /^(?:for|while|if)\(/.exec(s.slice(i, i + 6));
  if (kw) {
    let j = statementEnd(s, closeOf(s, i + kw[0].length - 1) + 1);
    if (kw[0] === "if(" && s.startsWith("else", j)) j = statementEnd(s, s[j + 4] === " " ? j + 5 : j + 4);
    return j;
  }
  let depth = 0;
  let quote: string | null = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (quote) {
      if (c === "\\") k++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return k; // the enclosing block's own closer
      // a block statement (switch, try...) closed: the next statement starts here, not at a `;`
      if (--depth === 0 && c === "}" && /[A-Za-z_$]/.test(s[k + 1] ?? "") && !s.startsWith("else", k + 1)) return k + 1;
    } else if (c === ";" && depth === 0) return k + 1;
  }
  return s.length;
}

/**
 * Index of the `:` that closes the ternary consequent starting at `from` (just after its `?`):
 * the first `:` at bracket depth 0 not claimed by a nested `?`, string-aware. -1 when the
 * enclosing bracket closes or the text ends first, i.e. nothing to bound the consequent by.
 */
function ternaryEnd(s: string, from: number): number {
  let depth = 0;
  let nested = 0;
  let quote: string | null = null;
  for (let k = from; k < s.length; k++) {
    const c = s[k];
    if (quote) {
      if (c === "\\") k++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (--depth < 0) return -1;
    } else if (depth === 0 && c === "?") nested++;
    else if (depth === 0 && c === ":") {
      if (nested-- === 0) return k;
    }
  }
  return -1;
}

/**
 * Every block `if("<name>"==<v>)…` or `"<name>"==<v>?…:` inside `text`, in order. The `if` may
 * test other names too (`if("BaseDmg"==d||"BaseHP"==d)`). The ternary form (TotalStats("STR"),
 * about 550 sites in the live N.js) is the consequent, from after the `?` to its matching `:`
 * (ternaryEnd); one it cannot bound is skipped, not guessed. The `&&` form (`"LUK"==d&&(…)`, the
 * tail of such a chain) is not read: a node that lands only there has no slice (unchecked).
 */
export function njsNamedBlocks(text: string, name: string): string[] {
  if (!/^\w+$/.test(name)) return [];
  const cmp = String.raw`"\w+"==[A-Za-z]`;
  const re = new RegExp(String.raw`if\((?:${cmp}\|\|)*"${name}"==[A-Za-z](?:\|\|${cmp})*\)|"${name}"==[A-Za-z]\?`, "g");
  const blocks: string[] = [];
  for (let m; (m = re.exec(text)); ) {
    const from = re.lastIndex;
    const end = m[0].endsWith("?") ? ternaryEnd(text, from) : statementEnd(text, from);
    if (end < 0) continue;
    blocks.push(text.slice(from, end));
    re.lastIndex = end;
  }
  return blocks;
}

/**
 * The named block(s) `if("<name>"==<v>)…` or `"<name>"==<v>?…:` inside `text`, joined by "\n", or
 * undefined. A function can hold several blocks of one name (TotalStats has 6 `calcEtcBonuses`)
 * and the game runs every one when the name matches, so all of them are returned.
 */
export function njsNamedBlock(text: string, name: string): string | undefined {
  const blocks = njsNamedBlocks(text, name);
  return blocks.length ? blocks.join("\n") : undefined;
}

/**
 * The numeric sub-branch `<n>==<v>…` of `text`, up to the next `<digits>==<v>` or the end of
 * `text`. `<v>` is one of the function's `params`: the loop variables and locals that N.js
 * also compares to numbers (`else if(25==l)`) are not the dispatcher.
 */
export function njsNumericBranch(text: string, n: number, params: string[]): string | undefined {
  // ponytail: heuristic slice, upgrade to a balanced parse if a dispatcher defeats it
  const letters = params.filter((p) => /^[A-Za-z]$/.test(p));
  if (!letters.length) return undefined;
  const v = `(${letters.join("|")})`;
  const start = new RegExp(String.raw`(?<![\w$.-])${n}==${v}(?![\w$])`).exec(text);
  if (!start) return undefined;
  const from = start.index + start[0].length;
  const next = new RegExp(String.raw`(?<![\w$.-])\d+==${start[1]}(?![\w$])`).exec(text.slice(from));
  return text.slice(start.index, next ? from + next.index : text.length);
}

/**
 * The N.js text a trace node stands for: the whole function when its first argument is not a
 * string; else the named block that string picks; with a number next, that block's numeric
 * branch, or the whole named block when the branch is not there (Summoning("VaultUpgBonus",20,0)
 * has no `20==b`). undefined when the function has no such named block: nothing to compare.
 */
export function njsSlice(fn: { params: string[]; body: string }, args: unknown[]): string | undefined {
  const [a0, a1] = args;
  if (typeof a0 !== "string") return fn.body;
  const named = njsNamedBlock(fn.body, a0);
  return (typeof a1 === "number" && named !== undefined ? njsNumericBranch(named, a1, fn.params) : undefined) ?? named;
}

export type ClosureCall = {
  fn: string;
  args: (string | number)[];
  depth: number;
  /** Length of the N.js text this row stands for (0 when not found). */
  chars: number;
  /**
   * "whole body": the slice is the whole function (the first argument is not a literal name, or
   * the function has no sub-case of that name: a data key, or a dispatch on another argument) and
   * the walk stops here. "not found": the function is not in N.js.
   */
  flag?: "whole body" | "not found";
  /** The function that holds the sub-case when `fn` hands it on (`Summoning` -> `Summoning2`). */
  via?: string;
};

const MAX_DEPTH = 6;
const ATTR_RE = /getGameAttribute\("(\w+)"\)|gameAttributes\.h\.(\w+)/g;
const DNSM_RE = /getGameAttribute\("DNSM"\)\.h\.(\w+)/g;

/**
 * The function a long one hands the rest to: `Summoning` ends `…:m._customBlock_Summoning2(d,b,e)`,
 * its own parameters unchanged, so a sub-case it does not hold ("VotingBonusz") is in Summoning2.
 */
function delegate(def: { params: string[]; body: string }, name: string): string | undefined {
  if (!def.params.length) return undefined;
  const re = new RegExp(String.raw`_customBlock_(\w+)\(${def.params.join(",")}\)`, "g");
  return [...def.body.matchAll(re)].map((m) => m[1]).filter((n) => n !== name).pop();
}

/**
 * Everything the game's `fn(...args)` reaches: its exact slice (njsSlice with the full args), the
 * calls in it with their literal args, and so on breadth first, each (fn, args) once at its
 * shallowest depth. Depth stops at 6; `capped` counts the calls left unwalked there.
 *
 * A function with no parameters (`PlayerHPmax()`) is its whole body, walked as an exact row.
 * A numeric first argument (`Companions(154)`, `MainframeBonus(14)`) gives that `<n>==<param>` branch
 * (njsNumericBranch), walked like a named sub-case; with no such branch, the whole function, as for a
 * first argument that is neither (`GetTalentNumber(…)` with a variable); so does a function with no
 * sub-case of the name given (`GetBribeBonus("34")`, `GetSetBonus("GODSHARD_SET","Bonus")`). That row
 * is flagged and its calls are NOT walked (TotalStats-sized bodies would explode the closure). Its
 * attribute and DNSM reads are still collected, but they are over-approximate, so they are also
 * listed in `loose` (names read only by whole-body rows). Only a function N.js lacks is "not found".
 */
export function njsClosure(
  norm: string,
  fn: string,
  args: (string | number)[]
): { calls: ClosureCall[]; attrs: string[]; dnsm: string[]; loose: { attrs: string[]; dnsm: string[] }; capped: number; unwalked: string[] } {
  const calls: ClosureCall[] = [];
  const exact = { attrs: new Set<string>(), dnsm: new Set<string>() };
  const whole = { attrs: new Set<string>(), dnsm: new Set<string>() };
  const unwalked = new Set<string>();
  const defs = new Map<string, ReturnType<typeof njsFunction>>();
  const defOf = (name: string) => defs.get(name) ?? (defs.set(name, njsFunction(norm, name)), defs.get(name));
  const key = (f: string, a: unknown[]) => f + JSON.stringify(a);
  const seen = new Set([key(fn, args)]);
  const queue = [{ fn, args, depth: 0 }];
  const reads = (text: string, into: typeof exact) => {
    for (const m of text.matchAll(ATTR_RE)) into.attrs.add(m[1] ?? m[2]);
    for (const m of text.matchAll(DNSM_RE)) into.dnsm.add(m[1]);
  };

  /** Collect the reads of an exact slice and queue its calls. */
  const walk = (text: string, depth: number, into: typeof exact) => {
    reads(text, into);
    for (const c of njsCalls(text)) {
      const next = { fn: c.block, args: c.args ?? [], depth: depth + 1 };
      const k = key(next.fn, next.args);
      if (seen.has(k)) continue;
      if (next.depth > MAX_DEPTH) unwalked.add(k);
      else {
        seen.add(k);
        queue.push(next);
      }
    }
  };

  for (const { fn: f, args: a, depth } of queue) {
    const own = defOf(f);
    let name = f;
    let def = own;
    let slice = def && njsSlice(def, a);
    for (const tried = new Set([f]); def && slice === undefined; ) {
      const next = delegate(def, name);
      if (!next || tried.has(next)) break;
      tried.add(next);
      name = next;
      def = defOf(name);
      slice = def && njsSlice(def, a);
    }
    if (own === undefined) {
      calls.push({ fn: f, args: a, depth, chars: 0, flag: "not found" });
      continue;
    }
    if (def === undefined || slice === undefined) {
      // the function exists but no sub-case slice does (njsSlice, nor the function it hands on to): all of it
      calls.push({ fn: f, args: a, depth, chars: own.body.length, flag: "whole body" });
      reads(own.body, whole);
      continue;
    }
    const via = name === f ? {} : { via: name };
    if (!def.params.length) {
      // PlayerHPmax(): nothing selects a sub-case, so the whole body is exactly the formula: walk it
      calls.push({ fn: f, args: a, depth, chars: slice.length, ...via });
      walk(slice, depth, exact);
      continue;
    }
    if (typeof a[0] === "number") {
      // a numeric dispatcher (MainframeBonus(14)): its `14==d` branch, walked like a named sub-case. No such branch
      // (a function that computes generically and branches on a few indexes, like ArcadeBonus) leaves the whole body.
      const branch = njsNumericBranch(slice, a[0], def.params);
      if (branch !== undefined) {
        calls.push({ fn: f, args: a, depth, chars: branch.length, ...via });
        walk(branch, depth, exact);
        continue;
      }
    }
    if (typeof a[0] !== "string") {
      calls.push({ fn: f, args: a, depth, chars: slice.length, flag: "whole body", ...via });
      reads(slice, whole);
      continue;
    }
    calls.push({ fn: f, args: a, depth, chars: slice.length, ...via });
    walk(slice, depth, exact);
  }
  const sorted = (...sets: Set<string>[]) => [...new Set(sets.flatMap((x) => [...x]))].sort();
  const looseOnly = (w: Set<string>, e: Set<string>) => sorted(w).filter((x) => !e.has(x));
  return {
    calls,
    attrs: sorted(exact.attrs, whole.attrs),
    dnsm: sorted(exact.dnsm, whole.dnsm),
    loose: { attrs: looseOnly(whole.attrs, exact.attrs), dnsm: looseOnly(whole.dnsm, exact.dnsm) },
    capped: unwalked.size,
    /** The calls left unwalked at the depth cap, as `Fn[args]` (JSON), so a merge can drop those another root walked. */
    unwalked: [...unwalked],
  };
}
