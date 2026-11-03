// Ctx: what every game function reads from. Like the game, one computation is cached per
// (function, arguments); unlike the game, it can also say how it got there (the trace).
import type { GameState } from "./state";
import { NonFiniteResult } from "./errors";
import { traceRoot, type TraceNode } from "./trace";

export type { TraceNode } from "./trace";

export type Ctx = {
  readonly state: GameState;
  /** Character index the game reads as "the current player". */
  readonly player: number;
  /** Map the player stands on (the game's `CurrentMap`). */
  readonly map: number;
  /** Memo of `block` results for THIS player+map, like N.js TotStatMAP / DNSM. */
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
  trace: o.trace ? traceRoot() : null,
});

/** Another character on the same save: shares the state and the trace, not the cache. */
export const withPlayer = (ctx: Ctx, player: number): Ctx => ({ ...ctx, player, cache: new Map() });

/**
 * Wraps a mirrored N.js function. Memoizes on `name + JSON.stringify(args)` (args are
 * strings/numbers), records a TraceNode when tracing (a cache hit is recorded as a leaf
 * noted "cached"), and throws NonFiniteResult instead of passing NaN/Infinity on.
 * Tracing off allocates no nodes and hands `fn` the caller's own Ctx.
 */
export function block<A extends unknown[]>(
  name: string,
  fn: (ctx: Ctx, ...a: A) => number
): (ctx: Ctx, ...a: A) => number {
  return (ctx, ...a) => {
    const key = name + JSON.stringify(a);
    const hit = ctx.cache.get(key);
    if (hit !== undefined) {
      ctx.trace?.children.push({ block: name, args: a, value: hit, children: [], note: "cached" });
      return hit;
    }
    const node: TraceNode | null = ctx.trace && { block: name, args: a, value: 0, children: [] };
    const value = fn(node ? { ...ctx, trace: node } : ctx, ...a);
    if (!Number.isFinite(value)) throw new NonFiniteResult(name, a, value);
    ctx.cache.set(key, value);
    if (node) {
      node.value = value;
      ctx.trace!.children.push(node); // after fn: a throw leaves no half-built node behind
    }
    return value;
  };
}

/**
 * A value the game has only at runtime (active buffs, masterclass forms, GenINFO...): 0,
 * and shown in the trace as "not counted" instead of passing as a silent zero. The only
 * sanctioned "not computable from the save" value.
 */
export function runtime(ctx: Ctx, name: string, note: string): number {
  ctx.trace?.children.push({ block: name, args: [], value: 0, children: [], note: `runtime: ${note}` });
  return 0;
}
