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

/** Every call under `trace` (not the node itself), depth-first in call order, cached leaves included. */
export function traceCalls(trace: TraceNode): Call[] {
  return trace.children.flatMap((n) => {
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
 * that block; one with a literal argument only by the same argument. `missing` is the useful
 * side: the game side is one piece of N.js text, ours the whole nested trace, so `extra` also
 * holds what our callees call.
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

/** The named block `if("<name>"==<v>)…` inside `text`, or undefined. */
export function njsNamedBlock(text: string, name: string): string | undefined {
  if (!/^\w+$/.test(name)) return undefined;
  const m = new RegExp(String.raw`if\("${name}"==[A-Za-z]\)`).exec(text);
  return m ? readBody(text, m.index + m[0].length)?.text : undefined;
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
