// ===== NODE.JS — Plain-data tree node helper =====
// 1:1 port of corgan-source/js/stats/node.js. Rendering-agnostic.
// toRenderNode() in tree-builder converts to _bNode for display.

export type NodeFmt = "raw" | "+" | "x" | "%";

export type ArkhNode = {
  name: string;
  val: number;
  children?: ArkhNode[];
  fmt?: NodeFmt;
  note?: string;
  /** When true, this node starts collapsed in the deep-view regardless of
   *  the default "depth < N open" heuristic. Used for low-signal branches
   *  (e.g. Chip Cap-Break when inactive) that would otherwise grab
   *  vertical space alongside the heavyweight Additive Pool /
   *  Post-Processing sections. */
  defaultClosed?: boolean;
};

export function node(
  name: string,
  val: number | null | undefined,
  children?: ArkhNode[] | null,
  opts?: { fmt?: NodeFmt; note?: string; defaultClosed?: boolean }
): ArkhNode {
  const r: ArkhNode = { name, val: val || 0 };
  if (children && children.length) r.children = children;
  if (opts) {
    if (opts.fmt) r.fmt = opts.fmt;
    if (opts.note) r.note = opts.note;
    if (opts.defaultClosed) r.defaultClosed = true;
  }
  return r;
}

// Numeric tree result — backward-compat for code that treats results as numbers.
export type TreeResult = {
  val: number;
  children: ArkhNode[] | null;
  valueOf(): number;
  toString(): string;
};

export function treeResult(
  val: number | null | undefined,
  children?: ArkhNode[] | null
): TreeResult {
  const v = val || 0;
  const ch = children && children.length ? children : null;
  return {
    val: v,
    children: ch,
    valueOf() {
      return v;
    },
    toString() {
      return String(v);
    },
  };
}
