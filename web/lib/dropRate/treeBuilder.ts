// Tree node structure rendered by components/dropRate/DrTree.tsx.
//
// Node shape (rendering-agnostic, JSON-safe):
//   { name, val, fmt?, note?, children?: TreeNode[] }
//
// fmt drives how the value is rendered:
//   '+'    → "+12.3" (additive percentage contribution)
//   'x'    → "1.23x" (multiplicative factor)
//   'raw'  → "12.3"  (plain number, no suffix)

export type TreeNodeFmt = "+" | "x" | "raw";

export type TreeNode = {
  name: string;
  val: number;
  fmt?: TreeNodeFmt;
  note?: string;
  children?: TreeNode[];
};
