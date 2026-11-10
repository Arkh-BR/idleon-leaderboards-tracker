// computeTome around the engine (stubbed): a refusal stops the count, the memo, the lock, the character and map it counts on.
import { beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  tomeQty: vi.fn(),
  Summoning: vi.fn(),
  makeCtx: vi.fn((state: unknown, where: unknown) => ({ state, where })),
  data: {} as Record<string, unknown>,
}));
vi.mock("@/lib/game/njs/TomeQTY", () => ({ tomeQty: engine.tomeQty }));
vi.mock("@/lib/game/njs/Summoning", () => ({ Summoning: engine.Summoning }));
vi.mock("@/lib/game/ctx", () => ({ makeCtx: engine.makeCtx }));
vi.mock("@/lib/game/trackers/page", () => ({ stateOf: () => ({ charNames: ["a", "b"], data: engine.data }) }));

import { computeTome } from "@/lib/tome/compute";
import { TOME_TASKS } from "@/lib/tome/tasks";

const env = () => ({ data: {}, charNames: ["a", "b"] });

beforeEach(() => {
  engine.tomeQty.mockReset().mockReturnValue(5);
  engine.Summoning.mockReset().mockImplementation((_c, d: string) => ("isTomeUnlocked" == d ? 1 : "TomeLvReq" == d ? 400 : 10));
  engine.makeCtx.mockClear();
  engine.data = {};
});

describe("computeTome", () => {
  it("a refused save runs the event once: every row is MISSING, the error is kept", () => {
    engine.tomeQty.mockImplementation(() => {
      throw new Error("boom");
    });
    const r = computeTome(env());
    expect(engine.tomeQty).toHaveBeenCalledTimes(1);
    expect(r.error).toBe("boom");
    expect(r.missingCount).toBe(TOME_TASKS.length);
    expect(r.rows.every((x) => x.pts === null && x.source.startsWith("MISSING"))).toBe(true);
  });

  it("a second call with the same input is served from the memo", () => {
    const input = env();
    const first = computeTome(input);
    const calls = engine.tomeQty.mock.calls.length;
    expect(computeTome(input)).toBe(first);
    expect(engine.tomeQty).toHaveBeenCalledTimes(calls);
    const json = JSON.stringify(env());
    const fromText = computeTome(json);
    expect(computeTome(json)).toBe(fromText);
    expect(computeTome(input)).not.toBe(first); // one entry: the string replaced it
  });

  it("a task the account level has not unlocked says so, with its level", () => {
    engine.Summoning.mockImplementation((_c, d: string, b: number) => ("isTomeUnlocked" == d ? (b == 0 ? 0 : 1) : "TomeLvReq" == d ? 777 : 0));
    const rows = computeTome(env()).rows;
    expect(rows.find((x) => x.computeIdx === 0)).toMatchObject({ unlocked: false, lvReq: 777 });
    expect(rows.find((x) => x.computeIdx === 1)).toMatchObject({ unlocked: true });
  });

  it("counts on the logged-in character's map, else 251, unless the caller says", () => {
    engine.data = { PTimeAway_0: 1, PTimeAway_1: 2, CurrentMap_1: 77 };
    computeTome(env());
    expect(engine.makeCtx.mock.calls.at(-1)![1]).toEqual({ player: 1, map: 77 });
    engine.data = { PTimeAway_0: 2 };
    computeTome(env());
    expect(engine.makeCtx.mock.calls.at(-1)![1]).toEqual({ player: 0, map: 251 });
    computeTome(env(), { player: 1, map: 5 });
    expect(engine.makeCtx.mock.calls.at(-1)![1]).toEqual({ player: 1, map: 5 });
  });
});
