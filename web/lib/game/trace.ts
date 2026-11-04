// The opt-in trace of a Ctx: one node per `block` call (or per `runtime` value), nested
// the way the calls nested. See `block` in ctx.ts for how nodes get here.

export type TraceNode = {
  /** The mirrored N.js function (or Runtime value) name. */
  block: string;
  args: unknown[];
  value: number;
  /** Calls made while this one ran, in call order. */
  children: TraceNode[];
  /**
   * `"cached"`: a memo hit (a leaf: the subtree is on the first call of the same name+args).
   * `"runtime: <why>"`: a value the save cannot give, counted as 0.
   * `"assumed: <why>"`: a value the save cannot give, stood in for by a stated assumption (`assumed()` in ctx.ts); `value` is that value.
   *   An `(assumed)` leaf is the same for a value a load step assumed (lib/game/migrations, `GameState.assumed`), left where it is read.
   * `"threw: <message>"`: the call threw (rethrown to the caller; never cached).
   * `"absent: asNumber(null) = 0"`: an `(absent)` leaf for an index the save lacks, read through `asNum`
   * (lib/game/attr) as N.js reads it, `c.asNumber(null)`: 0, but visible here instead of a silent zero.
   */
  note?: string;
  /**
   * Which character ran this call, set only where it differs from the parent's (`withPlayer`
   * shares the trace, so a cross-character call would otherwise look like the parent's own).
   * The root always carries the base player.
   */
  player?: number;
};

// The player each node was made for, so a child can tell whether it differs from its
// parent without parent pointers (a `withPlayer` Ctx points at the parent node but has
// another player).
const playerOf = new WeakMap<TraceNode, number>();

export const traceRoot = (player: number): TraceNode => {
  const root: TraceNode = { block: "(root)", args: [], value: 0, children: [], player };
  playerOf.set(root, player);
  return root;
};

/** A node for a call by `player` under `parent`. The caller appends it to `parent.children`. */
export function traceNode(
  parent: TraceNode,
  player: number,
  block: string,
  args: unknown[],
  value = 0,
  note?: string
): TraceNode {
  const node: TraceNode = { block, args, value, children: [] };
  if (note !== undefined) node.note = note;
  if (player !== playerOf.get(parent)) node.player = player;
  playerOf.set(node, player);
  return node;
}
