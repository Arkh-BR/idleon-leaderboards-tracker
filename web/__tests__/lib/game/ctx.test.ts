import { describe, it, expect } from "vitest";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { NonFiniteResult } from "@/lib/game/errors";
import { assumed, block, makeCtx, runtime, withPlayer, type Ctx } from "@/lib/game/ctx";

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

  it("withPlayer shares the cache (its keys include the player) and keeps the same state", () => {
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
    expect(other.cache).toBe(ctx.cache);
    expect(f(other)).toBe(2); // another player: computed, not the first player's value
    expect(calls).toBe(2);
    expect(f(ctx)).toBe(0); // each player's value stays its own, and is a hit
    expect(f(withPlayer(ctx, 2))).toBe(2); // a second withPlayer for the same player is a hit too
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

  it("withPlayer keeps nesting under the same trace, and the node says which player ran it", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    const p = block("player", (c) => c.player);
    p(withPlayer(ctx, 3));
    expect(ctx.trace!.children).toEqual([{ block: "player", args: [], value: 3, children: [], player: 3 }]);
  });

  it("player is only set where it differs from the parent's", () => {
    const leaf = block("leaf", (c) => c.player);
    const mid = block("mid", (c) => leaf(c) + leaf(withPlayer(c, 5)) + leaf(withPlayer(c, 5)));
    const ctx = makeCtx(state, { player: 2, map: 0, trace: true });
    mid(ctx);
    expect(ctx.trace!.player).toBe(2); // the root carries the base player
    const [m] = ctx.trace!.children;
    expect(m.player).toBeUndefined(); // same as the root's
    expect(m.children.map((n) => [n.value, n.player, n.note])).toEqual([
      [2, undefined, undefined], // same player as `mid`
      [5, 5, undefined], // another player
      [5, 5, "cached"], // withPlayer shares the cache: the second call for player 5 is a hit
    ]);
  });

  it("a cached leaf and a runtime node carry player too when it differs", () => {
    const leaf = block("leaf", () => 1);
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    const other = withPlayer(ctx, 4);
    leaf(other);
    leaf(other);
    runtime(other, "Buff", "x");
    expect(ctx.trace!.children.map((n) => [n.note, n.player])).toEqual([
      [undefined, 4],
      ["cached", 4],
      ["runtime: x", 4],
    ]);
  });

  it("a cache hit inside a block is a cached leaf under that block", () => {
    const twice = block("twice", (c, x: number) => inner(c, x) + inner(c, x));
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(twice(ctx, 3)).toBe(12);
    const [t] = ctx.trace!.children;
    expect(t.children).toEqual([
      { block: "inner", args: [3], value: 6, children: [] },
      { block: "inner", args: [3], value: 6, children: [], note: "cached" },
    ]);
  });

  it("a block that throws is recorded as 'threw: ...' (with what ran before) and rethrown", () => {
    const boom = block("boom", (c) => {
      inner(c, 1);
      throw new Error("kaput");
    });
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(() => boom(ctx)).toThrow("kaput");
    expect(ctx.trace!.children).toEqual([
      {
        block: "boom",
        args: [],
        value: 0,
        children: [{ block: "inner", args: [1], value: 2, children: [] }],
        note: "threw: kaput",
      },
    ]);
  });

  it("an outer block that catches a throwing inner one: node kept, nothing cached, inner reruns", () => {
    let calls = 0;
    const flaky = block("flaky", () => {
      calls++;
      throw new Error("nope");
    });
    const outer2 = block("outer2", (c) => {
      try {
        return flaky(c);
      } catch {
        return -1;
      }
    });
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(outer2(ctx)).toBe(-1);
    expect(ctx.trace!.children[0].children.map((n) => [n.block, n.note])).toEqual([["flaky", "threw: nope"]]);
    expect(() => flaky(ctx)).toThrow("nope");
    expect(calls).toBe(2); // the failure was not cached
    expect(ctx.cache.has("0|0|flaky[]")).toBe(false);
  });

  it("a non-finite result is recorded as a threw node too", () => {
    const bad = block("bad", () => Number.NaN);
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(() => bad(ctx)).toThrow(NonFiniteResult);
    inner(ctx, 1);
    expect(ctx.trace!.children.map((n) => [n.block, n.note?.startsWith("threw: ")])).toEqual([
      ["bad", true],
      ["inner", undefined],
    ]);
  });
});

describe("cache key", () => {
  it("map is part of the key: a Ctx copy that keeps the cache never returns another map's value", () => {
    let calls = 0;
    const atMap = block("atMap", (c) => {
      calls++;
      return c.map * 10;
    });
    const ctx = makeCtx(state, { player: 0, map: 1 });
    const elsewhere = { ...ctx, map: 7 }; // same cache object
    expect(elsewhere.cache).toBe(ctx.cache);
    expect(atMap(ctx)).toBe(10);
    expect(atMap(elsewhere)).toBe(70);
    expect(atMap(ctx)).toBe(10);
    expect(calls).toBe(2);
  });

  it("player is part of the key too", () => {
    const who = block("who", (c) => c.player + 100);
    const ctx = makeCtx(state, { player: 0, map: 0 });
    const shared = { ...ctx, player: 2 };
    expect(who(ctx)).toBe(100);
    expect(who(shared)).toBe(102);
    expect(who(ctx)).toBe(100);
  });
});

describe("block args", () => {
  it("a NaN or infinite numeric arg throws NonFiniteResult naming the block, before fn runs", () => {
    let calls = 0;
    const f = block("F", (_c, x: number) => {
      calls++;
      return x;
    });
    const ctx = makeCtx(state, { player: 0, map: 0 });
    expect(() => f(ctx, Number.NaN)).toThrow(NonFiniteResult);
    expect(() => f(ctx, Infinity)).toThrow(NonFiniteResult);
    expect(() => f(ctx, -Infinity)).toThrow("F(");
    expect(calls).toBe(0);
    expect(ctx.cache.size).toBe(0);
  });

  it("args are strings or numbers: anything else is a compile error", () => {
    // @ts-expect-error a Map would serialize to {} and collide with every other Map
    block("x", (_c, _m: Map<string, number>) => 1);
    // @ts-expect-error an optional arg can be undefined, which serializes to null
    block("y", (_c, _o?: number) => 1);
    block("ok", (_c, _n: number, _s: string) => 1); // fine
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

describe("assumed", () => {
  it("returns the value it is given and leaves a noted node carrying it when tracing", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(assumed(ctx, "GenINFO[92][14]", "the lab is connected", 1)).toBe(1);
    expect(ctx.trace!.children).toEqual([
      { block: "GenINFO[92][14]", args: [], value: 1, children: [], note: "assumed: the lab is connected" },
    ]);
  });

  it("returns the value without a trace and allocates nothing", () => {
    const ctx = makeCtx(state, { player: 0, map: 0 });
    expect(assumed(ctx, "Tome", "x", 54321.5)).toBe(54321.5);
    expect(ctx.trace).toBeNull();
  });

  it("is not a runtime value: the note says assumed, the value is the assumption (runtime is always 0)", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    assumed(ctx, "A", "why", 7);
    runtime(ctx, "R", "why");
    expect(ctx.trace!.children.map((n) => [n.block, n.value, n.note])).toEqual([
      ["A", 7, "assumed: why"],
      ["R", 0, "runtime: why"],
    ]);
  });

  it("keeps the full reason in `detail`, apart from the short `note` a page shows; no detail, no field", () => {
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    assumed(ctx, "A", "short words", 7, "the long reason @123456");
    assumed(ctx, "B", "short words", 7);
    expect(ctx.trace!.children[0]).toMatchObject({ note: "assumed: short words", detail: "the long reason @123456" });
    expect("detail" in ctx.trace!.children[1]).toBe(false);
  });

  it("nests under the block that asked for it; the player is on the block that differs, not repeated on its leaf", () => {
    const f = block("F", (c) => 5 + assumed(c, "GenINFO", "not saved", 1));
    const ctx = makeCtx(state, { player: 0, map: 0, trace: true });
    expect(f(withPlayer(ctx, 3))).toBe(6);
    expect(ctx.trace!.children[0]).toMatchObject({ block: "F", player: 3 });
    expect(ctx.trace!.children[0].children[0]).toMatchObject({ block: "GenINFO", value: 1, note: "assumed: not saved" });
    expect(ctx.trace!.children[0].children[0].player).toBeUndefined();
    // a leaf asked for directly by another player carries it
    assumed(withPlayer(ctx, 4), "Direct", "x", 2);
    expect(ctx.trace!.children[1].player).toBe(4);
  });
});
