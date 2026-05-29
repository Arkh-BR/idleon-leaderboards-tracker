// ===== Idleon updater — N.js data extractor =====
// Pulls STABLE-KEYED data out of the minified Closure-compiled N.js bundle so
// that two versions can be diffed without the symbol-rename noise of a raw
// file diff. Three layers:
//
//   lists   — `<obj>.<StableName>=function(){return <literal>}` blocks. The obj
//             name is obfuscated and may change per build; <StableName> does
//             not. Covers CustomLists & most gameplay constants (228+ blocks).
//   items   — imperative `…b.h.<field>=<value>; … N.addNewEquip("KEY",…)` runs.
//             Every `.h.<field>=<value>` between two addNewEquip calls belongs
//             to the item the second call registers.
//   strings — readable string literals, as a content safety-net for whatever
//             the structured layers miss (maps, monsters, dialogue, talents).
//
// Pure text parsing — never executes N.js (it expects a browser/canvas).

export type Snapshot = {
  meta: { sha256: string; byteLength: number };
  items: Record<string, Record<string, string | number>>;
  lists: Record<string, unknown>;
  strings: string[];
};

export type ExtractResult = Pick<Snapshot, "items" | "lists" | "strings">;

/**
 * Reads one JS literal starting at `start` (which must point at `[`, `{`, `"`
 * or `'`). Scans with bracket-depth + string awareness so brackets inside
 * strings don't break balance. Returns the raw literal text and the index just
 * past it.
 */
function readLiteral(src: string, start: number): { raw: string; end: number } {
  const first = src[start];
  if (first === '"' || first === "'") {
    let i = start + 1;
    while (i < src.length) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === first) { i++; break; }
      i++;
    }
    return { raw: src.slice(start, i), end: i };
  }
  let depth = 0;
  let i = start;
  let inStr: string | null = null;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; i++; continue; }
    if (c === "[" || c === "{" || c === "(") depth++;
    else if (c === "]" || c === "}" || c === ")") {
      depth--;
      if (depth === 0) { i++; break; }
    }
    i++;
  }
  return { raw: src.slice(start, i), end: i };
}

/** Parse a literal as JSON when possible (clean structured diffs); else keep
 *  the raw text so nothing is ever silently dropped. */
function canonicalize(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const LIST_RE = /\.([A-Za-z][A-Za-z0-9_]*)=function\(\)\{return/g;

export function extractLists(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let m: RegExpExecArray | null;
  LIST_RE.lastIndex = 0;
  while ((m = LIST_RE.exec(src))) {
    const name = m[1];
    const litStart = LIST_RE.lastIndex;
    const c = src[litStart];
    if (c !== "[" && c !== "{" && c !== '"' && c !== "'") continue; // not a data literal
    const { raw } = readLiteral(src, litStart);
    out[name] = canonicalize(raw);
  }
  return out;
}

const EQUIP_RE = /addNewEquip\("([^"]+)"/g;
const FIELD_RE = /\.h\.([A-Za-z0-9_]+)=("(?:[^"\\]|\\.)*"|-?[0-9]+(?:\.[0-9]+)?)/g;

export function extractItems(src: string): Record<string, Record<string, string | number>> {
  const out: Record<string, Record<string, string | number>> = {};
  const calls = [...src.matchAll(EQUIP_RE)];
  for (let k = 0; k < calls.length; k++) {
    const m = calls[k];
    const key = m[1];
    const blockStart =
      k > 0 ? calls[k - 1].index! + calls[k - 1][0].length : Math.max(0, m.index! - 4000);
    const block = src.slice(blockStart, m.index!);
    const fields: Record<string, string | number> = {};
    let fm: RegExpExecArray | null;
    FIELD_RE.lastIndex = 0;
    while ((fm = FIELD_RE.exec(block))) {
      const fname = fm[1];
      const rawVal = fm[2];
      fields[fname] = rawVal[0] === '"' ? (JSON.parse(rawVal) as string) : Number(rawVal);
    }
    out[key] = fields;
  }
  return out;
}

/** Keep strings that look like human/game content, drop minifier noise.
 *  Requires a real content separator (space, or a game/description symbol).
 *  Bare CamelCase identifiers are deliberately excluded — when they are real
 *  game keys they already show up in `items`/`lists`, so dropping them here
 *  just keeps the string layer focused on descriptions, LANG, dialogue, etc. */
function isContentString(s: string): boolean {
  if (s.length < 3 || s.length > 240) return false;
  if ((s.match(/[A-Za-z]/g)?.length ?? 0) < 2) return false; // needs ≥2 letters
  return /[ _%{}@+]/.test(s);
}

// A `/` starts a regex (vs. division) when the previous significant char is one
// of these, or right after a regex-preceding keyword. Good enough for a minified
// bundle; the only cost of a wrong guess is one mis-scanned token.
const RE_PRECEDERS = new Set("(,=:[!&|?{};+-*/%^~<>".split(""));
const KW_RE = /(?:^|[^A-Za-z0-9_$])(?:return|typeof|instanceof|in|of|new|delete|void|do|else|case|yield|throw)$/;

/**
 * Lexes the bundle char-by-char, tracking string / template / regex / comment
 * state so quotes inside regex or single-quoted strings can't slide the pairing.
 * Collects only DOUBLE-quoted literals (where Idleon's content lives).
 */
export function extractStrings(src: string): string[] {
  const set = new Set<string>();
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let buf = "";
      while (j < n) {
        const d = src[j];
        if (d === "\\") { buf += "\\" + (src[j + 1] ?? ""); j += 2; continue; } // keep escapes literal
        if (d === c) break;
        buf += d;
        j++;
      }
      if (c === '"' && isContentString(buf)) set.add(buf);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < n) {
        const d = src[j];
        if (d === "\\") { j += 2; continue; }
        if (d === "`") break;
        j++;
      }
      i = j + 1;
      continue;
    }
    if (c === "/") {
      let k = i - 1;
      while (k >= 0 && /\s/.test(src[k])) k--;
      const prev = k >= 0 ? src[k] : "";
      const isRegex = prev === "" || RE_PRECEDERS.has(prev) || KW_RE.test(src.slice(Math.max(0, i - 12), i));
      if (isRegex) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const d = src[j];
          if (d === "\\") { j += 2; continue; }
          if (d === "\n") break;
          if (d === "[") inClass = true;
          else if (d === "]") inClass = false;
          else if (d === "/" && !inClass) break;
          j++;
        }
        i = j + 1;
        while (i < n && /[a-z]/i.test(src[i])) i++; // regex flags
        continue;
      }
    }
    i++;
  }
  return [...set].sort();
}

function isWordChar(ch: string): boolean {
  return ch !== "" && /[A-Za-z0-9_$]/.test(ch);
}

/**
 * Removes INSIGNIFICANT whitespace (the line-reflow the Closure Compiler sprays
 * at arbitrary token boundaries, which shifts every build) so the extractors see
 * a stable byte stream. String / template / regex / comment runs are copied
 * verbatim; whitespace is dropped, except a single space is kept between two
 * word chars so adjacent tokens (`return x`, `new Y`) don't fuse. This is what
 * makes the diff reflect real game changes instead of minifier noise.
 */
export function normalizeBundle(src: string): string {
  const n = src.length;
  const parts: string[] = [];
  let tail = ""; // last ≤16 emitted chars, for regex/keyword context
  let prevSig = ""; // last emitted non-space char
  function push(s: string): void {
    if (!s) return;
    parts.push(s);
    tail = (tail + s).slice(-16);
    for (let q = s.length - 1; q >= 0; q--) {
      if (!/\s/.test(s[q])) { prevSig = s[q]; break; }
    }
  }
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        const d = src[j];
        if (d === "\\") { j += 2; continue; }
        if (d === c) break;
        j++;
      }
      push(src.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (c === "/") {
      const isRegex = prevSig === "" || RE_PRECEDERS.has(prevSig) || KW_RE.test(tail);
      if (isRegex) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const d = src[j];
          if (d === "\\") { j += 2; continue; }
          if (d === "\n") break;
          if (d === "[") inClass = true;
          else if (d === "]") inClass = false;
          else if (d === "/" && !inClass) break;
          j++;
        }
        let end = j + 1;
        while (end < n && /[a-z]/i.test(src[end])) end++; // flags
        push(src.slice(i, end));
        i = end;
        continue;
      }
      push("/");
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      const after = src[j] ?? "";
      if (isWordChar(prevSig) && isWordChar(after)) push(" ");
      i = j;
      continue;
    }
    // normal run — accumulate until the next special char
    let j = i;
    while (j < n) {
      const d = src[j];
      if (d === '"' || d === "'" || d === "`" || d === "/" || /\s/.test(d)) break;
      j++;
    }
    push(src.slice(i, j));
    i = j;
  }
  return parts.join("");
}

export function extractAll(src: string): ExtractResult {
  const norm = normalizeBundle(src);
  return {
    items: extractItems(norm),
    lists: extractLists(norm),
    strings: extractStrings(norm),
  };
}
