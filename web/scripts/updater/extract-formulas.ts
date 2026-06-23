// ===== Idleon updater — formula extractor =====
// Captures the game's named gameplay custom-blocks AND the bodies of the
// _customBlock_ dispatcher functions from the N.js bundle, so two versions can
// be diffed at the LOGIC level (curve reworks, new terms) — invisible to a
// data-only diff. Two entry kinds:
//   1. Named blocks: if("<Name>"==<v>)return <expr>;  /  if("<Name>"==<v>){<block>}
//      for ANY single-letter dispatcher <v>; <Name> >= 3 chars. Key = <Name>.
//   2. Function scaffolds: <obj>._customBlock_<Name>=function(...){<body>}.
//      Key = "_customBlock_<Name>". Inner named-blocks are collapsed to `~` so the
//      scaffold reflects only logic OUTSIDE them (those are captured granularly
//      by #1) — avoids redundant churn while still catching number-dispatched
//      (if(918==d)) and direct-helper logic.
// Input must be the normalized bundle (extractAll passes normalizeBundle()'s
// output; tests pass clean fixtures).

const NAMED_RE = /if\("([A-Za-z][A-Za-z0-9_]{2,})"==[a-z]\)/g;
const FN_RE = /_customBlock_([A-Za-z0-9_]+)=function\([^)]*\)\{/g;

/** Reads a `return <expr>;` or a balanced `{<block>}` starting at `start`.
 *  String/paren/brace aware so `;` or `}` inside strings or nested calls
 *  don't terminate it early. Returns the text and the index just past it. */
function readBody(src: string, start: number): { text: string; end: number } | null {
  if (src.startsWith("{", start)) {
    let depth = 0, i = start, inStr: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
    }
    return { text: src.slice(start, i), end: i };
  }
  if (src.startsWith("return", start)) {
    let i = start + 6, depth = 0, inStr: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
      else if (c === ";" && depth === 0) break;
    }
    return { text: src.slice(start + 6, i).trim(), end: i };
  }
  return null;
}

/** Collapses each inner named-block `if("X"==v)<body>` to `if("X"==v)~`, so a
 *  function scaffold's text excludes the named-block bodies (captured separately). */
function collapseNamedBlocks(body: string): string {
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  NAMED_RE.lastIndex = 0;
  while ((m = NAMED_RE.exec(body))) {
    const inner = readBody(body, NAMED_RE.lastIndex);
    if (!inner) continue;
    result += body.slice(last, NAMED_RE.lastIndex) + "~";
    last = inner.end;
    NAMED_RE.lastIndex = inner.end;
  }
  return result + body.slice(last);
}

export function extractFormulas(norm: string): Record<string, string> {
  const out: Record<string, string> = {};

  // 1. Named blocks (any single-letter dispatcher).
  let m: RegExpExecArray | null;
  NAMED_RE.lastIndex = 0;
  while ((m = NAMED_RE.exec(norm))) {
    const body = readBody(norm, NAMED_RE.lastIndex);
    if (body) {
      out[m[1]] = body.text; // last write wins on duplicate names
      NAMED_RE.lastIndex = body.end;
    }
  }

  // 2. _customBlock_ function scaffolds (named-blocks collapsed).
  FN_RE.lastIndex = 0;
  while ((m = FN_RE.exec(norm))) {
    const body = readBody(norm, FN_RE.lastIndex - 1); // start at the `{`
    if (body) {
      out["_customBlock_" + m[1]] = collapseNamedBlocks(body.text);
      FN_RE.lastIndex = body.end;
    }
  }

  return out;
}
