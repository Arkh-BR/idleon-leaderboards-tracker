import { describe, it, expect } from "vitest";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { NonFiniteResult } from "@/lib/game/errors";
import { block, makeCtx, runtime, withPlayer, type Ctx } from "@/lib/game/ctx";

const state = buildGameState({
  data: { Lv0_0: [1] },
  charNames: ["Arkhe"],
  companion: null,
  guildData: { id: null, stats: null, members: [], points: null },
  serverVars: null,
  tournament: { user: null, match: null, global: null, leaderboard: [] },
  accountCreateTime: 1_600_000_000_000,
  lastUpdated: 1_700_000_000_000,
} as GameEnvelope);

describe("block cache", () => {
  it("runs fn once per (name, args) and reuses the value", () => {
    let calls = 0;
    const f = block("F", (_c, x: number, s: string) => {
      calls++;
      return x * 2 + s.length;
    });
    const ctx = makeCtx(state, { player: 0, map: 1 });
    expect(f(ctx, 3, "ab")).toBe(8);
    expect(f(ctx, 3, "ab")).toBe(8);
    expect(calls).toBe(1);
    expect(f(ctx, 4, "ab")).toBe(10); // other args: computed
    expect(calls).toBe(2);
  });

  it("two blocks never share a key", () => {
    const a = block("A", () => 1);
    const b = block("B", () => 2);
    const ctx = makeCtx(state, { player: 0, map: 0 });
    expect([a(ctx), b(ctx)]).toEqual([1, 2]);
  });

  it("withPlayer gets its own cache and keeps the same state", () => {
    let calls = 0;
    const f = block("F", (c) => {
      calls++;
      return c.player;
    });
    const ctx = makeCtx(state, { player: 0, map: 5 });
    expect(f(ctx)).toBe(0);
    const other = withPlayer(ctx, 2);
    expect(other.state).toBe(ctx.state);
    expect(other.map).toBe(5);
    expect(other.cache).not.toBe(ctx.cache);
    expect(f(other)).toBe(2);
    expect(calls).toBe(2);
    expect(f(ctx)).toBe(0); // the original cache still holds its own value
    expect(calls).toBe(2);
  });
});

describe("block trace", () => {
  const inner = block("inner", (_c, x: number) => x * 2);
  const outer = block("outer", (c, tag: string) => inner(c, 1) + inner(c, 2) + tag.length);

  it("nested blocks produce a nested trace with args and values", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(outer(ctx, "a")).toBe(7);
    expect(ctx.trace!.children).toEqual([
      {
        block: "outer",
        args: ["a"],
        value: 7,
        children: [
          { block: "inner", args: [1], value: 2, children: [] },
          { block: "inner", args: [2], value: 4, children: [] },
        ],
      },
    ]);
  });

  it("a cache hit still shows up in the trace, as a leaf noted 'cached'", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    outer(ctx, "a");
    outer(ctx, "a");
    const [first, second] = ctx.trace!.children;
    expect(first.children).toHaveLength(2);
    expect(second).toEqual({ block: "outer", args: ["a"], value: 7, children: [], note: "cached" });
  });

  it("trace off: same value as trace on, no trace, and fn gets the caller's own Ctx (no copy, no nodes)", () => {
    let seen: Ctx | null = null;
    const probe = block("probe", (c) => {
      seen = c;
      return outer(c, "a");
    });
    const on = makeCtx(state, { player: 0, map: 0, trace: true });
    const off = makeCtx(state, { player: 0, map: 0 });
    expect(probe(off)).toBe(probe(on));
    expect(seen).not.toBe(on); // tracing copies the Ctx...
    expect(off.trace).toBeNull();
    const off2 = makeCtx(state, { player: 0, map: 0, trace: false });
    probe(off2);
    expect(seen).toBe(off2); // ...tracing off does not
  });

  it("withPlayer keeps nesting under the same trace", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    const p = block("player", (c) => c.player);
    p(withPlayer(ctx, 3));
    expect(ctx.trace!.children).toEqual([{ block: "player", args: [], value: 3, children: [] }]);
  });

  it("a throwing block leaves no half-built node behind", () => {
    const bad = block("bad", () => Number.NaN);
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(() => bad(ctx)).toThrow();
    inner(ctx, 1);
    expect(ctx.trace!.children.map((n) => n.block)).toEqual(["inner"]);
  });
});

describe("non-finite results", () => {
  it("NaN throws NonFiniteResult naming the block and its args", () => {
    const bad = block("TotalStats", (_c, _s: string) => Number.NaN);
    const ctx = makeCtx(state, { player: 0, map: 0 });
    expect(() => bad(ctx, "STR")).toThrow(NonFiniteResult);
    expect(() => bad(ctx, "STR")).toThrow('TotalStats(["STR"])');
  });

  it("Infinity throws too, and a failure is never cached", () => {
    let calls = 0;
    const bad = block("Inf", () => {
      calls++;
      return Infinity;
    });
    const ctx = makeCtx(state, { player: 0, map: 0 });
    expect(() => bad(ctx)).toThrow(NonFiniteResult);
    expect(() => bad(ctx)).toThrow(NonFiniteResult);
    expect(calls).toBe(2);
  });
});

describe("runtime", () => {
  it("returns 0 and leaves a noted node when tracing", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(runtime(ctx, "Buff 108", "active buff, not in the save")).toBe(0);
    expect(ctx.trace!.children).toEqual([
      { block: "Buff 108", args: [], value: 0, children: [], note: "runtime: active buff, not in the save" },
    ]);
  });

  it("returns 0 without a trace and allocates nothing", () => {
    const ctx = makeCtx(state, { player: 0, map: 0 });
    expect(runtime(ctx, "Buff 108", "x")).toBe(0);
    expect(ctx.trace).toBeNull();
  });

  it("nests under the block that asked for it", () => {
    const f = block("F", (c) => 5 + runtime(c, "GenINFO", "not saved"));
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(f(ctx)).toBe(5);
    expect(ctx.trace!.children[0].children[0]).toMatchObject({ block: "GenINFO", note: "runtime: not saved" });
  });
});
