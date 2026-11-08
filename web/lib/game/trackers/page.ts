// What every tracker adapter shares: the trimmed trace it hands the page (Ruling L), the GameState kept per envelope object (Ruling M),
// and the root's note for an older save.
//
// The page persists the flattened tree in every snapshot (localStorage), so the trace below a source is trimmed (Ruling L): the source keeps
// the N.js call(s) it stands for (the evidence of its value, even when the call was a memo hit), and below them only the branches that lead
// to a `runtime:` or `assumed:` note, which spec section 5 wants visible. The whole trace is still there for debugging: run the tracker's
// call on a Ctx made with `trace: true`.
import type { StatResult } from "@/lib/statTracker/config";
import type { TraceNode } from "../ctx";
import { buildGameState, type GameEnvelope, type GameState } from "../state";

type Node = StatResult["tree"];

/** The branch has a `runtime:` or `assumed:` note (a value the save cannot give, spec section 5): it stays visible in the page's tree. */
export const flagged = (n: TraceNode): boolean => /^(runtime|assumed):/.test(n.note ?? "") || n.children.some(flagged);

/**
 * A trace node as the page's node: `Sailing("ArtifactBonus", 3, 0)`, its value, its note (cached / runtime / assumed / absent). Its calls
 * are kept only where they lead to a flagged note (see the header).
 */
export function traceTree(n: TraceNode): Node {
  const calls = n.children.filter(flagged);
  const call = n.args.length ? `${n.block}(${n.args.map((a) => JSON.stringify(a)).join(", ")})` : n.block;
  return {
    name: n.player === undefined ? call : `${call} [character ${n.player}]`,
    val: n.value,
    fmt: "raw",
    ...(n.note ? { note: n.note } : {}),
    ...(calls.length ? { children: calls.map(traceTree) } : {}),
  };
}

/**
 * An older save is computed after the game's own load steps (lib/game/migrations): the root says so in a few words; which steps ran is
 * `state.migrations` (the page shows a count, not their ids).
 */
export function migratedNote(state: GameState): string | undefined {
  const n = state.migrations.length;
  return n ? `migrated from an older game version (${n} load step${n === 1 ? "" : "s"})` : undefined;
}

// The page calls compute(save, charIdx, …) with the same parsed save object on every character switch (StatCalculator keeps it in state), so
// the state (a deep clone + freeze, and the Tome score kept on it) is built once per envelope object, and shared by every tracker. Each call
// still gets its own Ctx and memo: the memo keys include the player, so a shared one would reuse nothing across characters, and a second call
// for the same character would find the tracker's call already cached and have no trace to read the tree from. The state is immutable; the
// envelope is assumed not to change between calls (the page parses it once per load and computes only on lib/game; lib/arkh, were it run on
// the same envelope, leaves it as it found it: trackers/damageState.test.ts runs both in either order).
const states = new WeakMap<object, GameState>();

/** The GameState of an envelope, built once per envelope object. An envelope the build refuses throws, and is not kept. */
export function stateOf(save: unknown): GameState {
  const known = typeof save === "object" && save !== null ? states.get(save) : undefined;
  const state = known ?? buildGameState(save as GameEnvelope);
  if (!known && typeof save === "object" && save !== null) states.set(save, state); // after the build: an envelope it refuses is not kept
  return state;
}

/** The value of a call the tracked block makes (its block and arguments): the page's sources are built from these. */
export type Take = (block: string, ...args: (string | number)[]) => number;

/** The direct call of `from` with this block and these arguments (all of them, or only the leading ones when `exact` is false), not one in `used`. */
export const findCall = (from: TraceNode, block: string, args: readonly (string | number)[], used?: Set<TraceNode>, exact = true): TraceNode | undefined =>
  from.children.find((n) => n.block === block && (!exact || n.args.length === args.length) && args.every((a, i) => n.args[i] === a) && !used?.has(n));

/**
 * A `Take` over the direct calls of `from`: it finds the call (each call once when `used` is given), pushes it, trimmed, to `kept` (the source's
 * children) and returns its value. No such call throws, naming `who` (the tracker's message) and the source `id`.
 */
export function takeFrom(from: TraceNode, used: Set<TraceNode> | undefined, kept: Node[], who: string, id: string, exact = true): Take {
  return (block, ...args) => {
    const n = findCall(from, block, args, used, exact);
    if (!n) throw new Error(`${who} made no${used ? " (further)" : ""} ${block}(${args.map((a) => JSON.stringify(a)).join(", ")}) call for "${id}"`);
    used?.add(n);
    kept.push(traceTree(n));
    return n.value;
  };
}

/** Like `takeFrom`, but a call the block did not make gives `undefined` instead of throwing (a term read only on some passes: the caller falls back to a noted leaf). */
export function optFrom(from: TraceNode, used: Set<TraceNode>, kept: Node[]): (block: string, ...args: (string | number)[]) => number | undefined {
  return (block, ...args) => {
    const n = findCall(from, block, args, used);
    if (!n) return undefined;
    used.add(n);
    kept.push(traceTree(n));
    return n.value;
  };
}

/** `a` equals `b` to a relative 1e-9: the tree must give the call's total (spec section 4). */
export const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
