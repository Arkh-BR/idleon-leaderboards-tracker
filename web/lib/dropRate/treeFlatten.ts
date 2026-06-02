// Tree flattening utilities for snapshotting the full DR breakdown.
//
// `flattenTree` walks the detailed DR tree and produces a Record<path, value>
// keyed by a stable path (slash-joined node names with an index suffix to
// disambiguate same-named siblings). The same path scheme is used by
// ArkhTree at render time to look up baseline values for the delta column.

import type { ArkhNode } from "@/lib/arkh/node";

export type FlatTree = Record<string, number>;

/** Build a stable path for a node based on its parent path and its
 *  position among same-named siblings. Returns the full path string. */
export function nodePath(
  parentPath: string,
  node: ArkhNode,
  siblings: ArkhNode[],
  index: number
): string {
  // Count how many earlier siblings share this name → if >0, suffix with #i
  let dupCount = 0;
  for (let i = 0; i < index; i++) {
    if (siblings[i] && siblings[i].name === node.name) dupCount++;
  }
  const segment = dupCount > 0 ? `${node.name}#${dupCount}` : node.name;
  return parentPath ? `${parentPath} / ${segment}` : segment;
}

/** Walks the tree and returns Record<path, val> for every node. */
export function flattenTree(root: ArkhNode | null): FlatTree {
  const out: FlatTree = {};
  if (!root) return out;

  function walk(node: ArkhNode, parentPath: string, siblings: ArkhNode[], idx: number) {
    const path = nodePath(parentPath, node, siblings, idx);
    out[path] = Number(node.val) || 0;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      walk(kids[i], path, kids, i);
    }
  }
  // Root has no siblings — treat as the only one
  walk(root, "", [root], 0);
  return out;
}

/** Lookup a delta (current - baseline) for a path. Returns null if the path
 *  isn't in the baseline (new node) or baseline is null. */
export function deltaAt(
  baseline: FlatTree | null,
  path: string,
  current: number
): number | null {
  if (!baseline) return null;
  const prev = baseline[path];
  if (typeof prev !== "number") return null;
  return current - prev;
}
