// Test helpers that read the game's load steps out of the live N.js (a support module: vitest only collects *.test.ts).
//
// `njsBlock` cuts one statement out of the bundle by its head (`if(395>a.engine.getGameAttribute("DoOnceREAL")){`, …): the tests pin
// what each ported migration does by its text, found by its gate, never by its offset. `runFill` reads the lists a fill block builds:
// those blocks are long runs of one grammar (`DummyList2 = []`, `DummyList2.push(<literal>)`, `<X>.push(DummyList2)`,
// `<X>[i] = DummyList2`, `for (e = 0; N > e;) e++, …`), so they are interpreted here, statement by statement, and anything else in
// them throws: the test then fails instead of reading a block it does not understand.

/** The index just past the bracket that closes the one at `i` (strings skipped). */
function close(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") {
      for (j++; s[j] !== c; j++) if (s[j] === "\\") j++;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") if (--depth === 0) return j + 1;
  }
  throw new Error("unbalanced brackets");
}

/** Splits `s` on `sep` characters outside brackets and strings. */
function split(s: string, seps: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") {
      for (j++; s[j] !== c; j++) if (s[j] === "\\") j++;
    } else if (c === "(" || c === "[" || c === "{") j = close(s, j) - 1;
    else if (seps.includes(c)) {
      out.push(s.slice(start, j));
      start = j + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * The statement of `src` (newlines removed, as the bundle wraps lines anywhere) that starts with `head`, which must occur exactly once
 * after `from` (a function's head, to search inside it): an `if (…) { … }` / `if (…) stmt;` / `for (…) stmt;` up to its end, or an
 * expression statement (`N > DoOnceREAL && (…)`) up to its `;`.
 */
export function njsBlock(src: string, head: string, from = ""): string {
  const s = src.replace(/\n/g, "");
  const base = from ? s.indexOf(from) : 0;
  if (base < 0) throw new Error(`no ${from} in N.js`);
  const at = s.indexOf(head, base);
  if (at < 0) throw new Error(`no ${head} in N.js`);
  if (s.indexOf(head, at + 1) >= 0 && (!from || s.indexOf(head, at + 1) < s.indexOf("=function(", at))) throw new Error(`${head} twice in N.js`);
  let j = at;
  if (s.startsWith("if(", j) || s.startsWith("for(", j)) {
    j = close(s, s.indexOf("(", j));
    if (s[j] === "{") return s.slice(at, close(s, j));
  }
  // a statement: up to the `;` (or the closing brace of the enclosing block) outside brackets
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") {
      for (j++; s[j] !== c; j++) if (s[j] === "\\") j++;
    } else if (c === "(" || c === "[" || c === "{") j = close(s, j) - 1;
    else if (c === ";" || c === "}") return s.slice(at, j + (c === ";" ? 1 : 0));
  }
  throw new Error(`${head}: no end`);
}

/**
 * A block's text, shortened so a test can pin all of it readably: `a.engine.getGameAttribute("X")` is `X`, `a.engine.gameAttributes.h.X=`
 * is `X=`, the game's way of starting a new scratch list (`e=a.engine;b=[];e.gameAttributes.h.DummyList2=b`) is `DummyList2=[]`, and a run
 * of the same push is `DummyList2.push(0)x15`. Nothing else changes, so the whole block is still pinned.
 */
export function compact(block: string): string {
  return block
    .replace(/a\.engine\.getGameAttribute\("(\w+)"\)/g, "$1")
    .replace(/(\w)=a\.engine([;,])(\w)=\[\]\2\1\.gameAttributes\.h\.DummyList2=\3/g, "DummyList2=[]")
    .replace(/a\.engine\.gameAttributes\.h\.(\w+)=/g, "$1=")
    .replace(/(DummyList2\.push\([^()]*\))(?:([;,])\1)+/g, (run, push: string, sep: string) => `${push}x${run.split(sep).length}`);
}

const GA = /^a\.engine\.getGameAttribute\("(\w+)"\)$/;
const literal = (v: string): unknown => (/^-?[\d.]+(e\d+)?$/.test(v) ? Number(v) : /^"[^"]*"$/.test(v) ? v.slice(1, -1) : (() => { throw new Error(`not a literal: ${v}`); })());

/**
 * Runs the statements of a fill block (the body inside its braces) on `attrs` (attribute name -> list, changed in place) and returns
 * them. Lists pushed or assigned are the very `DummyList2` objects, as in the game.
 */
export function runFill(body: string, attrs: Record<string, unknown[]>): Record<string, unknown[]> {
  const locals: Record<string, unknown[]> = {};
  let dummy: unknown[] | undefined;
  const attr = (name: string) => {
    if (!attrs[name]) throw new Error(`fill reads ${name}, which the test did not give`);
    return attrs[name];
  };
  const run = (stmt: string): void => {
    let m: RegExpMatchArray | null;
    if ((m = stmt.match(/^for\((?:var )?(\w+)=0;(\d+)>\1;\)\1\+\+,(.*)$/s))) {
      for (let k = 0; k < Number(m[2]); k++) split(m[3], ",").forEach(run);
    } else if ((m = stmt.match(/^var (.*)$/s))) split(m[1], ",").forEach(run);
    else if (/^\w+=a\.engine$/.test(stmt)) return;
    else if ((m = stmt.match(/^(\w+)=\[\]$/))) locals[m[1]] = [];
    else if ((m = stmt.match(/^\w+\.gameAttributes\.h\.DummyList2=(\w+)$/))) dummy = locals[m[1]];
    else if ((m = stmt.match(/^(.*)\.push\((.*)\)$/s)) && GA.test(m[1])) {
      const target = m[1].match(GA)![1];
      const arg = m[2].match(GA)?.[1] === "DummyList2" ? dummy : literal(m[2]);
      if (target === "DummyList2") dummy!.push(arg);
      else attr(target).push(arg);
    } else if ((m = stmt.match(/^(a\.engine\.getGameAttribute\("\w+"\))((?:\[\d+\])+)=(.*)$/s))) {
      const path = [...m[2].matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
      let target = attr(m[1].match(GA)![1]) as unknown[];
      for (const i of path.slice(0, -1)) target = target[i] as unknown[];
      target[path[path.length - 1]] = m[3].match(GA)?.[1] === "DummyList2" ? dummy : literal(m[3]);
    } else throw new Error(`fill statement not understood: ${stmt.slice(0, 120)}`);
  };
  split(body, ";").forEach(run);
  return attrs;
}
