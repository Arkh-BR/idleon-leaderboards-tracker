// Ctx: what every game function reads from. Like the game, one computation is cached per
// (function, arguments); unlike the game, it can also say how it got there (the trace).
import type { GameState } from "./state";
import { NonFiniteResult } from "./errors";
import { traceNode, traceRoot, type TraceNode } from "./trace";

export type { TraceNode } from "./trace";

export type Ctx = {
  readonly state: GameState;
  /** Character index the game reads as "the current player". */
  readonly player: number;
  /** Map the player stands on (the game's `CurrentMap`). */
  readonly map: number;
  /** Memo of `block` results, like N.js TotStatMAP / DNSM. Keys include player and map. */
  readonly cache: Map<string, number>;
  /**
   * null = tracing off. Otherwise the node new calls are appended to: the root `makeCtx`
   * made, or, inside a block, that block's own node. It is never reassigned: `block` hands
   * `fn` a copy of the Ctx pointing at the child node, so the caller's Ctx keeps the root.
   */
  readonly trace: TraceNode | null;
};

export const makeCtx = (state: GameState, o: { player: number; map: number; trace?: boolean }): Ctx => ({
  state,
  player: o.player,
  map: o.map,
  cache: new Map(),
  trace: o.trace ? traceRoot(o.player) : null,
});

/**
 * Another character on the same save: shares the state, the trace and the cache. The cache keys
 * include the player, so sharing never mixes values, and a second `withPlayer` for the same
 * character hits what the first computed.
 */
export const withPlayer = (ctx: Ctx, player: number): Ctx => ({ ...ctx, player });

/**
 * Wraps a mirrored N.js function. Conventions, because the cache key and the call-diff
 * (lib/diagnose/njsCalls) both read them:
 * - `name` equals the N.js `_customBlock_<name>` suffix exactly;
 * - `args` mirror the N.js call literally, trailing literals included: write
 *   `Summoning(ctx, "VaultUpgBonus", 20, 0)`, not `…, 20)`. Otherwise the same game call
 *   splits into two cache keys and a call-diff match fails.
 *
 * Memoizes on player + map + `name + JSON.stringify(args)`
 * (so a Ctx copy that shares the cache, like withPlayer, never mixes players or maps), records a
 * TraceNode when tracing (a cache hit is a leaf noted "cached"; a call that throws is kept
 * noted "threw: ..." and rethrown, never cached), and throws NonFiniteResult instead of
 * passing NaN/Infinity on, as a result or as a numeric argument (JSON would turn those
 * into `null` and alias distinct calls). Args are strings/numbers by type.
 * Tracing off allocates no nodes and hands `fn` the caller's own Ctx.
 */
export function block<A extends (string | number)[]>(
  name: string,
  fn: (ctx: Ctx, ...a: A) => number
): (ctx: Ctx, ...a: A) => number {
  return (ctx, ...a) => {
    for (const x of a) if (typeof x === "number" && !Number.isFinite(x)) throw new NonFiniteResult(name, a, x, true);
    const key = `${ctx.player}|${ctx.map}|${name}${JSON.stringify(a)}`;
    const hit = ctx.cache.get(key);
    if (hit !== undefined) {
      if (ctx.trace) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, name, a, hit, "cached"));
      return hit;
    }
    const node = ctx.trace && traceNode(ctx.trace, ctx.player, name, a);
    let value: number;
    try {
      value = fn(node ? { ...ctx, trace: node } : ctx, ...a);
      if (!Number.isFinite(value)) throw new NonFiniteResult(name, a, value);
    } catch (e) {
      if (node) {
        node.note = `threw: ${e instanceof Error ? e.message : String(e)}`;
        ctx.trace!.children.push(node); // keep it: a caller may catch, and a later "cached" leaf must have a home
      }
      throw e;
    }
    ctx.cache.set(key, value);
    if (node) {
      node.value = value;
      ctx.trace!.children.push(node); // after fn, so siblings stay in call order
    }
    return value;
  };
}

/**
 * A value the game has only at runtime (active buffs, masterclass forms, GenINFO...): 0,
 * and shown in the trace as "not counted" instead of passing as a silent zero. One of the two
 * sanctioned "not computable from the save" values, with `assumed()` below.
 */
export function runtime(ctx: Ctx, name: string, note: string): number {
  if (ctx.trace) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, name, [], 0, `runtime: ${note}`));
  return 0;
}

/**
 * A stand-in for state the game has only at runtime and the save cannot give, stated openly: it returns `value` (the assumption) and shows
 * in the trace as `assumed: <note>` carrying that value. The second sanctioned non-save value, next to `runtime()`: use it where counting
 * 0 would make the number wrong and a decision has been made to count something else (the Laboratory's connection, the Tome actor's
 * score). Like a `runtime` leaf it stands for no N.js function: `traceCalls` skips it and `verifyMap` reports a block that only
 * appears this way as "runtime".
 */
export function assumed(ctx: Ctx, name: string, note: string, value: number): number {
  if (ctx.trace) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, name, [], value, `assumed: ${note}`));
  return value;
}
