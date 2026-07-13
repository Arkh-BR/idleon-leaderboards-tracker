import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { card } from "@/lib/arkh/stats/systems/common/cards";
import { CARD_DR_BONUS, CARD_DR_MULTI } from "@/lib/arkh/stats/data/common/cards";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Uses a golden-cache save (gitignored); skips in CI where it's absent.
const CACHE = "scripts/updater/golden/.cache/0celot8.json";
const cardRows = (id: number) =>
  (card.resolve(id, { saveData, charIdx: 0 } as never).children || []).filter(
    (c) => /\(Card /.test(c.name)
  );

describe.skipIf(!existsSync(CACHE))("card resolver catalog", () => {
  it("lists EVERY obtainable additive DR card, even unequipped", () => {
    loadSaveData(JSON.parse(readFileSync(CACHE, "utf8")));
    // all additive DR cards are released → full catalog shows
    expect(cardRows(10)).toHaveLength(Object.keys(CARD_DR_BONUS).length);
  });

  it("drops unreleased placeholder multi cards (ExpGiven ≤ 1)", () => {
    loadSaveData(JSON.parse(readFileSync(CACHE, "utf8")));
    // 2 released of 4 total (Ancientfish/Magni filtered)
    expect(cardRows(101).length).toBeLessThan(Object.keys(CARD_DR_MULTI).length);
    expect(cardRows(101).length).toBeGreaterThan(0);
  });
});
