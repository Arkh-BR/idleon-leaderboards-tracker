// The node of every stat tree the pages show.

export type NodeFmt = "raw" | "+" | "x" | "%";

export type ArkhNode = {
  name: string;
  val: number;
  children?: ArkhNode[];
  fmt?: NodeFmt;
  note?: string;
  /** The row starts collapsed in the deep view, whatever its depth. */
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
