// The node of every stat tree the pages show (Ruling B: it lives here, and lib/arkh/node re-exports it).

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
