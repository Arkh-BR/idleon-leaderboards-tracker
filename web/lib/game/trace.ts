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
   */
  note?: string;
};

export const traceRoot = (): TraceNode => ({ block: "(root)", args: [], value: 0, children: [] });
