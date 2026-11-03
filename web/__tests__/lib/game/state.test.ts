import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { buildGameState, charKey, num, opt, type GameEnvelope } from "@/lib/game/state";
import { InvalidSaveValue, MissingSaveKey } from "@/lib/game/errors";

const env = (data: Record<string, unknown>, extra: Partial<GameEnvelope> = {}): GameEnvelope => ({
  data,
  charNames: ["Arkhe", "Markhe"],
  companion: { id: 7 },
  guildData: { id: null, stats: null, members: [], points: null },
  serverVars: { a: 1 },
  ...extra,
});

describe("GameState strict accessors", () => {
  const state = buildGameState(
    env({
      Lv0_3: [10, 20.5, [7, 8]],
      Plain: 42,
      Name: "not json",
      Starts: "[oops",
      NaNish: [Number.NaN, Infinity, "5"],
      Hole: [null, 1],
    })
  );

  it("num returns a present nested number", () => {
    expect(num(state, "Lv0_3", 0)).toBe(10);
    expect(num(state, "Lv0_3", 1)).toBe(20.5);
    expect(num(state, "Lv0_3", 2, 1)).toBe(8);
    expect(num(state, "Plain")).toBe(42);
  });

  it("a missing key throws MissingSaveKey carrying the exact path", () => {
    expect(() => num(state, "Nope", 0)).toThrow(MissingSaveKey);
    expect(() => num(state, "Lv0_3", 9)).toThrow("Lv0_3[9]");
    expect(() => num(state, "Lv0_3", 2, 5)).toThrow("Lv0_3[2][5]");
    expect(() => state.get("Nope")).toThrow(MissingSaveKey);
    try {
      num(state, "Lv0_3", 9);
    } catch (e) {
      expect(e).toBeInstanceOf(MissingSaveKey);
      expect((e as MissingSaveKey).key).toBe("Lv0_3[9]");
      expect(String(e)).toBe("MissingSaveKey: Lv0_3[9]");
    }
  });

  it("null counts as missing, and so does indexing through a non-container", () => {
    expect(() => num(state, "Hole", 0)).toThrow(MissingSaveKey);
    expect(() => num(state, "Plain", 0)).toThrow(MissingSaveKey);
    expect(() => num(state, "Name", 0)).toThrow(MissingSaveKey); // no string-char indexing
  });

  it("never walks the prototype chain", () => {
    expect(() => state.get("toString")).toThrow(MissingSaveKey);
    expect(() => num(state, "Lv0_3", "length")).toThrow(MissingSaveKey);
    expect(opt(state, "constructor")).toBeUndefined();
  });

  it("num throws InvalidSaveValue on NaN, Infinity and non-numbers", () => {
    expect(() => num(state, "NaNish", 0)).toThrow(InvalidSaveValue);
    expect(() => num(state, "NaNish", 1)).toThrow("NaNish[1]");
    expect(() => num(state, "NaNish", 2)).toThrow(InvalidSaveValue); // "5" is not coerced
    expect(() => num(state, "Name")).toThrow(InvalidSaveValue);
    expect(() => num(state, "Lv0_3")).toThrow(InvalidSaveValue); // an array is not a number
  });

  it("opt returns undefined where the path is absent, the value where present", () => {
    expect(opt(state, "Nope")).toBeUndefined();
    expect(opt(state, "Lv0_3", 9)).toBeUndefined();
    expect(opt(state, "Hole", 0)).toBeUndefined();
    expect(opt(state, "Lv0_3", 0)).toBe(10);
    expect(opt(state, "Lv0_3", 2)).toEqual([7, 8]);
  });

  it("charKey builds the per-character save key", () => {
    expect(charKey("EquipOrder", 8)).toBe("EquipOrder_8");
  });

  it("keeps non-JSON strings as strings and does not parse a broken JSON-looking one", () => {
    expect(state.get("Name")).toBe("not json");
    expect(state.get("Starts")).toBe("[oops");
  });
});

describe("buildGameState parsing", () => {
  it("turns JSON-string keys into values", () => {
    const s = buildGameState(env({ EquipOrder_8: "[[1,2],[3]]", Obj: '{"a":[1,2]}', AFKtarget_0: "mushG" }));
    expect(s.get("EquipOrder_8")).toEqual([[1, 2], [3]]);
    expect(num(s, "EquipOrder_8", 0, 1)).toBe(2);
    expect(num(s, "Obj", "a", 1)).toBe(2);
    expect(s.get("AFKtarget_0")).toBe("mushG");
  });

  it("accepts values already parsed (IdleonToolbox profile shape)", () => {
    const s = buildGameState(env({ Lv0_3: [1, 2] }));
    expect(num(s, "Lv0_3", 1)).toBe(2);
  });

  it("keeps charNames, serverVars, companion and guildData", () => {
    const s = buildGameState(env({}));
    expect(s.charNames).toEqual(["Arkhe", "Markhe"]);
    expect(s.serverVars).toEqual({ a: 1 });
    expect(s.companion).toEqual({ id: 7 });
    expect(s.guildData.members).toEqual([]);
    expect(buildGameState(env({}, { serverVars: null })).serverVars).toBeNull();
  });

  it("does not freeze or alias the caller's envelope", () => {
    const e = env({ Lv0_3: [1, 2] }, { charNames: ["A"] });
    const s = buildGameState(e);
    (e.data.Lv0_3 as number[])[0] = 99; // the old engine mutates its envelope; that must stay legal
    e.charNames.push("B");
    expect(Object.isFrozen(e.data.Lv0_3)).toBe(false);
    expect(num(s, "Lv0_3", 0)).toBe(1);
    expect(s.charNames).toEqual(["A"]);
  });
});

describe("GameState immutability (ESM modules are strict, so writes throw)", () => {
  const s = buildGameState(
    env({ Lv0_3: [1, [2, 3]], Obj: '{"a":{"b":[4]}}', Plain: 5 }, { companion: { deep: [1] } })
  );

  it("is frozen at every depth", () => {
    expect(() => {
      (s.data as Record<string, unknown>).Plain = 6;
    }).toThrow(TypeError);
    expect(() => {
      (s.data as Record<string, unknown>).New = 1;
    }).toThrow(TypeError);
    expect(() => {
      (s.get("Lv0_3") as number[])[0] = 9;
    }).toThrow(TypeError);
    expect(() => {
      ((s.get("Lv0_3") as unknown[])[1] as number[]).push(4);
    }).toThrow(TypeError);
    expect(() => {
      (opt(s, "Obj", "a", "b") as number[]).push(5);
    }).toThrow(TypeError);
    expect(() => {
      (s.charNames as string[]).push("x");
    }).toThrow(TypeError);
    expect(() => {
      ((s.companion as { deep: number[] }).deep).push(2);
    }).toThrow(TypeError);
    expect(() => {
      (s as unknown as { data: unknown }).data = {};
    }).toThrow(TypeError);
    expect(num(s, "Lv0_3", 0)).toBe(1);
  });
});

const GOLDEN = "scripts/updater/golden/.cache";
const saves = existsSync(GOLDEN) ? readdirSync(GOLDEN).filter((f) => f.endsWith(".json")) : [];

describe.skipIf(saves.length === 0)("every golden save builds a GameState", () => {
  const load = (f: string) => JSON.parse(readFileSync(`${GOLDEN}/${f}`, "utf8").replace(/^\uFEFF/, ""));

  it.each(saves)("%s", (f) => {
    const raw = load(f);
    const s = buildGameState(raw);
    expect(Object.keys(s.data)).toHaveLength(Object.keys(raw.data).length);
    expect(s.charNames.length).toBe(raw.charNames.length);
    // no JSON string survives the parse, and the whole tree is frozen
    for (const [k, v] of Object.entries(s.data)) {
      if (typeof v === "string") expect(v.startsWith("[") || v.startsWith("{"), k).toBe(false);
      if (v !== null && typeof v === "object") expect(Object.isFrozen(v), k).toBe(true);
    }
  });

  it("freezing a full save stays fast", () => {
    const biggest = saves
      .map((f) => ({ f, raw: load(f) }))
      .sort((a, b) => JSON.stringify(b.raw.data).length - JSON.stringify(a.raw.data).length)[0];
    const t0 = performance.now();
    buildGameState(biggest.raw);
    const ms = performance.now() - t0;
    console.log(`buildGameState(${biggest.f}): ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(250); // loose CI-safe ceiling; typical is a few ms
  });
});
