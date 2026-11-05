import type { Ported } from "../ported";

/**
 * N.js `_customBlock_ReturnClasses(d)` @4153735: the classes class `d` has been on its way to it, itself last (it returns a list, so it is
 * a plain function, not a `block`). Below 6 (the beginner classes) it is 1..d. Else, with `base` the first class of its tree
 * (6 + 12 floor((d - 6) / 12)) and `n` = d - base: base, then the subclass and elite steps `n` passes.
 */
export function ReturnClasses(d: number): number[] {
  const list: number[] = []; // DN.AllClassDList
  if (6 > d) {
    for (let b = 0, n = d | 0; b < n; b++) list.push(b + 1);
    return list;
  }
  const tree = 12 * Math.floor((d - 6) / 12);
  const n = d - 6 - tree; // DN.AllClassDN
  if (7 < n) list.push(6 + tree, 6 + (tree + Math.ceil(n / 12)), 6 + (tree + Math.ceil((n - 5) / 2)), 6 + (tree + (n - 4)));
  else if (3 < n) list.push(6 + tree, 6 + (tree + Math.ceil(n / 12)), 6 + (tree + Math.ceil((n - 1) / 2)));
  else if (1 < n) list.push(6 + tree, 6 + (tree + Math.ceil(n / 12)));
  else if (0 < n) list.push(6 + tree);
  list.push(d);
  return list;
}

/** What this module covers (lib/game/ported.ts): the whole function, for any class. */
export const PORTED: Ported = "generic";
