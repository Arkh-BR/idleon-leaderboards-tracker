// Which calls does the game's formula make that ours does not? The game's side is read off the
// N.js text (njsCalls), ours off a trace (traceCalls); callDiff says what differs. This would
// have caught Artifact 25 omitting its TotalStats call. A call is a block name plus its first
// argument when that is a lone literal (the "VaultUpgBonus" of Summoning("VaultUpgBonus",20,0)).
// The N.js text must be normalized (scripts/updater/extract.ts normalizeBundle).

import type { TraceNode } from "@/lib/game/trace";
import { readBody } from "@/scripts/updater/extract-formulas";

export type Call = { block: string; arg0?: string | number };

// `<receiver>._customBlock_X(`, or a bare `k.X(` with a PascalCase X (the engine's own helpers,
// c.asNumber and the like, are camelCase). Then, if the first argument is a lone literal, it.
const CALL_RE =
  /(?:_customBlock_([A-Za-z0-9_]+)|(?<![\w$.])[A-Za-z]\.([A-Z][A-Za-z0-9]*))\((?:(?:"((?:[^"\\]|\\.)*)"|(-?\d*\.?\d+))(?=[,)]))?/g;

/** Every call in a piece of N.js, one entry per call site, in source order. */
export function njsCalls(body: string): Call[] {
  return [...body.matchAll(CALL_RE)].map((m) => {
    const block = m[1] ?? m[2];
    const arg0 = m[3] ?? (m[4] === undefined ? undefined : Number(m[4]));
    return arg0 === undefined ? { block } : { block, arg0 };
  });
}

/**
 * Every call under `trace` (not the node itself), depth-first in call order, cached and threw
 * nodes included. Runtime values are not: they are not N.js calls, and one named after a block
 * would hide that the block's real call is missing.
 */
export function traceCalls(trace: TraceNode): Call[] {
  return trace.children.flatMap((n) => {
    if (n.note?.startsWith("runtime:")) return [];
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
