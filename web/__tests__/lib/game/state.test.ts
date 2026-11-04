import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { GameState, buildGameState, charKey, num, opt, type GameEnvelope } from "@/lib/game/state";
import { InvalidSaveValue, MissingSaveKey } from "@/lib/game/errors";
import { OLDEST_GATE, UNPORTED_STEPS } from "@/lib/game/migrations";

const env = (data: Record<string, unknown>, extra: Partial<GameEnvelope> = {}): GameEnvelope => ({
  data,
  charNames: ["Arkhe", "Markhe"],
  companion: { id: 7 },
  guildData: { id: null, stats: null, members: [], points: null },
  serverVars: { a: 1 },
  tournament: { user: null, match: null, global: null, leaderboard: [] },
  accountCreateTime: 1_600_000_000_000,
  lastUpdated: 1_700_000_000_000,
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

  it("an absent address throws MissingSaveKey carrying the exact path", () => {
    expect(() => num(state, "Nope", 0)).toThrow(MissingSaveKey);
    expect(() => num(state, "Lv0_3", 9)).toThrow("Lv0_3[9]");
    expect(() => num(state, "Lv0_3", 2, 5)).toThrow("Lv0_3[2][5]");
    expect(() => num(state, "Lv0_3", 9, 0)).toThrow(MissingSaveKey); // absent parent
    expect(() => state.get("Nope")).toThrow(MissingSaveKey);
    try {
      num(state, "Lv0_3", 9);
    } catch (e) {
      expect(e).toBeInstanceOf(MissingSaveKey);
      expect((e as MissingSaveKey).key).toBe("Lv0_3[9]");
      expect(String(e)).toBe("MissingSaveKey: Lv0_3[9]");
    }
  });

  it("null counts as absent", () => {
    expect(() => num(state, "Hole", 0)).toThrow(MissingSaveKey);
    expect(opt(state, "Hole", 0)).toBeUndefined();
    expect(num(state, "Hole", 1)).toBe(1);
  });

  it("a present value of the wrong shape on the path is InvalidSaveValue, never absent", () => {
    // Plain is the number 42: it exists, it is just not something you can index.
    expect(() => num(state, "Plain", 0)).toThrow(InvalidSaveValue);
    expect(() => num(state, "Plain", 0)).toThrow("Plain[0]");
    expect(() => opt(state, "Plain", 0)).toThrow(InvalidSaveValue);
    expect(() => opt(state, "Lv0_3", 0, 1)).toThrow(InvalidSaveValue); // 10 is not a container
    expect(() => num(state, "Name", 0)).toThrow(InvalidSaveValue); // no string-char indexing
    expect(() => opt(state, "Name", 0)).toThrow(InvalidSaveValue);
  });

  it("a string index into an array is InvalidSaveValue, not absent", () => {
    expect(() => opt(state, "Lv0_3", "0")).toThrow(InvalidSaveValue);
    expect(() => num(state, "Lv0_3", "1")).toThrow(InvalidSaveValue);
    expect(() => opt(state, "Lv0_3", "length")).toThrow(InvalidSaveValue);
    expect(() => opt(state, "Lv0_3", 2, "0")).toThrow(InvalidSaveValue);
  });

  it("never walks the prototype chain", () => {
    expect(() => state.get("toString")).toThrow(MissingSaveKey);
    expect(opt(state, "constructor")).toBeUndefined();
    const o = buildGameState(env({ O: '{"a":1}' }));
    expect(opt(o, "O", "toString")).toBeUndefined();
    expect(opt(o, "O", "constructor")).toBeUndefined();
    expect(opt(o, "O", "a")).toBe(1);
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
    expect(opt(state, "Lv0_3", 9, 0)).toBeUndefined();
    expect(opt(state, "Lv0_3", 0)).toBe(10);
    expect(opt(state, "Lv0_3", 2)).toEqual([7, 8]);
  });

  it("charKey builds the per-character save key", () => {
    expect(charKey("EquipOrder", 8)).toBe("EquipOrder_8");
  });

  it("keeps non-JSON strings as strings", () => {
    expect(state.get("Name")).toBe("not json");
  });

  it("an unparseable [ or { string builds, but every accessor on that key refuses it", () => {
    // Not absent and not a value: opt(...) ?? default must not paper over corrupt data.
    expect(() => state.get("Starts")).toThrow(InvalidSaveValue);
    expect(() => state.get("Starts")).toThrow("Starts");
    expect(() => opt(state, "Starts")).toThrow(InvalidSaveValue);
    expect(() => opt(state, "Starts", 0)).toThrow(InvalidSaveValue);
    expect(() => num(state, "Starts", 0)).toThrow(InvalidSaveValue);
    expect(num(state, "Lv0_3", 0)).toBe(10); // other keys are unaffected
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

  it("keeps a __proto__ save key instead of dropping it", () => {
    const s = buildGameState(env(JSON.parse('{"__proto__":[1,2],"A":[3]}')));
    expect(Object.keys(s.data)).toEqual(["__proto__", "A"]);
    expect(num(s, "__proto__", 1)).toBe(2);
    expect(Object.getPrototypeOf(s.data)).toBeNull();
  });

  it("keeps every SaveEnvelope field and ignores top-level extras like parsedData", () => {
    const s = buildGameState({
      ...env({}),
      extraData: { totalTomePoints: 5, dropRate: 2 },
      parsedData: { junk: 1 },
    } as GameEnvelope);
    expect(s.charNames).toEqual(["Arkhe", "Markhe"]);
    expect(s.serverVars).toEqual({ a: 1 });
    expect(s.companion).toEqual({ id: 7 });
    expect(s.guildData.members).toEqual([]);
    expect(s.tournament.leaderboard).toEqual([]);
    expect(s.accountCreateTime).toBe(1_600_000_000_000);
    expect(s.lastUpdated).toBe(1_700_000_000_000);
    expect(s.extraData).toEqual({ totalTomePoints: 5, dropRate: 2 });
    expect("parsedData" in s).toBe(false);
  });

  it("extraData, companion and serverVars may be absent/null", () => {
    expect(buildGameState(env({})).extraData).toBeUndefined();
    expect(buildGameState(env({}, { extraData: undefined })).extraData).toBeUndefined();
    expect(buildGameState(env({}, { companion: null })).companion).toBeNull();
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

  it("the constructor itself clones and freezes (no unfrozen way in)", () => {
    const e = env({ Lv0_3: [1, 2], Obj: '{"a":[1]}' });
    const s = new GameState(e);
    expect(Object.isFrozen(s.data.Lv0_3)).toBe(true);
    expect(Object.isFrozen(s.get("Obj"))).toBe(true);
    expect(Object.isFrozen(e.data.Lv0_3)).toBe(false);
  });
});

describe("buildGameState rejects a malformed envelope with a named error", () => {
  const bad = (patch: Record<string, unknown>) => () =>
    buildGameState({ ...env({}), ...patch } as unknown as GameEnvelope);

  it.each(["data", "charNames", "companion", "guildData", "serverVars", "tournament", "accountCreateTime", "lastUpdated"])(
    "missing %s",
    (field) => {
      expect(bad({ [field]: undefined })).toThrow(MissingSaveKey);
      expect(bad({ [field]: undefined })).toThrow(`envelope.${field}`);
    }
  );

  it("wrong types", () => {
    expect(bad({ data: [] })).toThrow(InvalidSaveValue);
    expect(bad({ data: "x" })).toThrow("envelope.data");
    expect(bad({ charNames: "Arkhe" })).toThrow("envelope.charNames");
    expect(bad({ guildData: null })).toThrow("envelope.guildData");
    expect(bad({ tournament: 3 })).toThrow("envelope.tournament");
    expect(bad({ lastUpdated: Number.NaN })).toThrow("envelope.lastUpdated");
    expect(bad({ accountCreateTime: "1" })).toThrow("envelope.accountCreateTime");
    expect(bad({ serverVars: 1 })).toThrow("envelope.serverVars");
    expect(bad({ extraData: 1 })).toThrow("envelope.extraData");
  });

  it("not an object at all", () => {
    expect(() => buildGameState(null as unknown as GameEnvelope)).toThrow(InvalidSaveValue);
    expect(() => buildGameState(null as unknown as GameEnvelope)).toThrow("envelope");
  });
});

describe("GameState immutability (ESM modules are strict, so writes throw)", () => {
  const s = buildGameState(
    env(
      { Lv0_3: [1, [2, 3]], Obj: '{"a":{"b":[4]}}', Plain: 5 },
      {
        companion: { deep: [1] },
        tournament: { user: { x: [1] }, match: null, global: null, leaderboard: [] },
        extraData: { totalTomePoints: 1, list: [1] } as GameEnvelope["extraData"],
      }
    )
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
      (s.companion as { deep: number[] }).deep.push(2);
    }).toThrow(TypeError);
    expect(() => {
      (s.tournament.user as { x: number[] }).x.push(2);
    }).toThrow(TypeError);
    expect(() => {
      (s.extraData as { list: number[] }).list.push(2);
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
  const load = (f: string) => {
    const text = readFileSync(`${GOLDEN}/${f}`, "utf8").replace(/^﻿/, "");
    return { raw: JSON.parse(text), size: text.length };
  };

  it.each(saves)("%s", (f) => {
    const { raw } = load(f);
    const s = buildGameState(raw);
    if (raw.data.DoOnceREAL < OLDEST_GATE) {
      // older than the game's load steps ported (lib/game/migrations): every read is refused
      expect(s.refusal?.key).toBe(UNPORTED_STEPS);
      expect(() => s.data).toThrow(MissingSaveKey);
      return;
    }
    expect(s.refusal).toBeUndefined();
    // every save key is there, plus the attributes the game's load gives an older save (a loader step that ran)
    for (const k of Object.keys(raw.data)) expect(Object.hasOwn(s.data, k), k).toBe(true);
    for (const k of Object.keys(s.data).filter((k) => !Object.hasOwn(raw.data, k))) expect(s.migrations.some((m) => m.startsWith(`${k} = [] `)), k).toBe(true);
    expect(Object.keys(s.corrupt)).toEqual([]);
    expect(s.charNames.length).toBe(raw.charNames.length);
    expect(s.lastUpdated).toBe(raw.lastUpdated);
    expect(s.accountCreateTime).toBe(raw.accountCreateTime);
    expect(s.extraData === undefined).toBe(raw.extraData === undefined);
    expect("parsedData" in s).toBe(false);
    // no JSON string survives the parse, and the whole tree is frozen
    for (const [k, v] of Object.entries(s.data)) {
      if (typeof v === "string") expect(v.startsWith("[") || v.startsWith("{"), k).toBe(false);
      if (v !== null && typeof v === "object") expect(Object.isFrozen(v), k).toBe(true);
    }
  });

  it("freezing a full save stays fast", () => {
    const loaded = saves.map((f) => ({ f, ...load(f) }));
    const biggest = loaded.reduce((a, b) => (b.size > a.size ? b : a));
    const t0 = performance.now();
    buildGameState(biggest.raw);
    const ms = performance.now() - t0;
    console.log(`buildGameState(${biggest.f}): ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(250); // loose CI-safe ceiling; typical is a few ms
  });
});
