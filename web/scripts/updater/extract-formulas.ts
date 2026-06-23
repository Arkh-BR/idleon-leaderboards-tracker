// ===== Idleon updater — formula extractor =====
// Captures the game's named gameplay custom-blocks from the N.js bundle:
//   if("<Name>"==d)return <expr>;     and     if("<Name>"==d){<block>}
// `d` is the gameplay dispatcher arg. Returns { name -> expr/block text } so
// two versions can be diffed at the LOGIC level (curve reworks, new terms),
// which a data-only diff can't see. Input must be the normalized bundle
// (extractAll passes the normalizeBundle() output; tests pass clean fixtures).

const BLOCK_RE = /if\("([A-Za-z][A-Za-z0-9_]*)"==d\)/g;

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

export function extractFormulas(norm: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(norm))) {
    const body = readBody(norm, BLOCK_RE.lastIndex);
    if (body) {
      out[m[1]] = body.text; // last write wins on duplicate names
      BLOCK_RE.lastIndex = body.end;
    }
  }
  return out;
}
