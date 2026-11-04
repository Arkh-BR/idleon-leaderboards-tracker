import { describe, it, expect } from "vitest";
import { formatGameValue, gameResolution, normalizeGameText, parseGameValue } from "@/lib/readings/format";
import type { StatKey } from "@/lib/readings/types";

// Every StatKey, as the game prints it. The Player Info strings are the
// 2026-11-03 in-game readings (fixtures/readings.json); the numbers are chosen
// so the game's ceil/floor ladders land on them (x.5 steps, away from float dust).
describe("formatGameValue — Player Info panel (N.js PlayerInfoNumbers @6710302)", () => {
  it.each<[number, number, string]>([
    [9.0295e33, 1.64745e34, "💎9030₸~16475₸"], // ARKHE #0
    [1.63095e34, 2.27755e34, "💎16310₸~22776₸"], // Markhe #8, weapon
    [1.30125e34, 1.81705e34, "💎13013₸~18171₸"], // Markhe #8, no weapon
    [4.76043385e37, 8.68578605e37, "💎47604339₸~86857861₸"], // farkhe #3
    [150, 200.4, "150~201"], // below 9999999: plain ceil, no unit
  ])("damage %s~%s → %s", (min, value, shown) => expect(formatGameValue("damage", { min, value })).toBe(shown));

  it("damage needs the Min — a bare Max is not the game's line", () => {
    expect(() => formatGameValue("damage", { value: 1 })).toThrow(/min/i);
  });

  it.each<[StatKey, number, string]>([
    ["maxHp", 3.955e14, "396T"],
    ["maxHp", 3.435e14, "344T"],
    ["maxHp", 3.375e14, "338T"],
    ["maxHp", 7.705e11, "771B"],
    ["maxHp", 1e8, "100000000"], // 1E8<HP is strict: still Math.round
    ["maxHp", 1e8 + 1, "101M"], // above it, NotateNumber "Big" (ceil)
    ["maxMp", 31863341.2, "31863341"],
    ["maxMp", 31940684, "31940684"], // no separators below 1e8
    ["maxMp", 5.0991e9, "5.1B"], // MP goes through "Big" too, same 1E8 cut as HP
  ])("%s %s → %s", (stat, value, shown) => expect(formatGameValue(stat, { value })).toBe(shown));

  it.each<[StatKey, number, string]>([
    ["str", 92009075, "92,009,075"],
    ["str", 81085001, "81,085,001"],
    ["agi", 23083334, "23,083,334"],
    ["wis", 69001715, "69,001,715"],
    ["luk", 20084444, "20,084,444"],
    ["luk", 999, "999"],
    ["str", 999999999, "999,999,999"], // 1E9>STR: CommaNotation
    ["str", 1.5e9, "1.5B"], // else NotateNumber "Big"
  ])("%s %s → %s", (stat, value, shown) => expect(formatGameValue(stat, { value })).toBe(shown));

  it.each<[number, string]>([
    [5.8312e35, "5.83E35"], // Markhe, no weapon
    [2.7765e35, "2.77E35"], // farkhe
    [1.5e12, "1.5T"],
    [999, "999"],
  ])("accuracy %s → %s", (value, shown) => expect(formatGameValue("accuracy", { value })).toBe(shown));
});

describe("formatGameValue — Tome (CommaNotation + '_PTS', N.js @5711306 / @5715961)", () => {
  it.each<[StatKey, number, string]>([
    ["tomeScore", 55439, "55,439 PTS"],
    ["tomeTask", 253, "253 PTS"],
    ["tomeScore", 1234567, "1,234,567 PTS"],
    ["tomeTask", 0, "0 PTS"],
  ])("%s %s → %s", (stat, value, shown) => expect(formatGameValue(stat, { value })).toBe(shown));
});

// One value per kit tracker, from its own format test, with the page's unit.
describe("formatGameValue — kit trackers (page formatTotal + unit)", () => {
  it.each<[StatKey, number, string]>([
    ["dropRateV2", 12345.99, "12345x"],
    ["dropRateV2", 5, "5.00x"],
    ["coinMulti", 6.773746899414287e35, "6.77e35x"], // lowercase e since 2026-10-16
    ["coinMulti", 3.5e11, "350Bx"],
    ["expMulti", 1.4504214791708842e19, "14504214Tx"],
    ["expMulti", 12.346, "12.35x"],
    ["afkGains", 422.31870591798446, "42231%"],
    ["multikill", 81706.99, "81706%"],
    ["artifactFind", 12345.6, "12.4Kx"],
    ["artifactFind", 5, "5.00x"],
  ])("%s %s → %s", (stat, value, shown) => expect(formatGameValue(stat, { value })).toBe(shown));
});

describe("formatGameValue — edge cases", () => {
  it("a non-finite value prints a dash, with no unit", () => {
    expect(formatGameValue("coinMulti", { value: NaN })).toBe("—");
    expect(formatGameValue("maxHp", { value: Infinity })).toBe("—");
    expect(formatGameValue("damage", { min: 1, value: NaN })).toBe("—");
  });

  it("covers every StatKey", () => {
    const keys: StatKey[] = [
      "damage", "dropRateV2", "coinMulti", "expMulti", "afkGains", "multikill", "artifactFind",
      "maxHp", "maxMp", "accuracy", "str", "agi", "wis", "luk", "tomeScore", "tomeTask",
    ];
    for (const k of keys) expect(formatGameValue(k, { min: 1, value: 2 })).toEqual(expect.any(String));
  });
});

describe("normalizeGameText", () => {
  it.each<[string, string]>([
    ["  💎9030₸~16475₸ \n", "💎9030₸~16475₸"],
    ["55,439   PTS", "55,439 PTS"],
    ["a\u00a0 b\t c", "a b c"],
    ["", ""],
  ])("%j → %j", (raw, norm) => expect(normalizeGameText(raw)).toBe(norm));
});

describe("parseGameValue — the number behind a game text (diagnose's game side)", () => {
  it.each<[StatKey, string, number]>([
    ["damage", "💎9030₸~16475₸", 16475e30], // Damage compares on Max
    ["damage", "💎47604339₸~86857861₸", 86857861e30],
    ["damage", "💎1.5~2.25", 2.25e18], // 💎 with no glyph: ×1e18 tiers
    ["damage", "150~201", 201],
    ["damage", "3.2M~4.5T", 4.5e12],
    ["maxHp", "396T", 396e12],
    ["maxMp", "5.1B", 5.1e9],
    ["accuracy", "5.83E35", 5.83e35],
    ["str", "92,009,075", 92009075],
    ["coinMulti", "6.77e35x", 6.77e35],
    ["coinMulti", "350Bx", 350e9],
    ["expMulti", "14504214Tx", 14504214e12],
    ["afkGains", "42231%", 422.31], // AFK prints ⌊100·rate⌋%
    ["multikill", "81706%", 81706],
    ["artifactFind", "12.4Kx", 12400],
    ["dropRateV2", "5.00x", 5],
    ["tomeScore", " 55,439  PTS ", 55439],
  ])("%s %j → %s", (stat, text, value) => expect(parseGameValue(stat, text)).toBe(value));

  it("NaN when the text is not a number", () => {
    expect(parseGameValue("coinMulti", "—")).toBeNaN();
    expect(parseGameValue("damage", "")).toBeNaN();
  });
});

describe("gameResolution — one unit of the last digit shown, relative to the number", () => {
  it.each<[StatKey, string, number]>([
    ["damage", "💎9030₸~16475₸", 1 / 16475], // the Max's digits
    ["damage", "💎47604339₸~86857861₸", 1 / 86857861],
    ["dropRateV2", "5.00x", 0.01 / 5],
    ["coinMulti", "6.77e35x", 0.01 / 6.77],
    ["str", "92,009,075", 1 / 92009075],
    ["afkGains", "42231%", 1 / 42231],
  ])("%s %j → %s", (stat, text, rel) => expect(gameResolution(stat, text)).toBeCloseTo(rel, 15));

  it("NaN when the text is not a number", () => expect(gameResolution("coinMulti", "—")).toBeNaN());
});
