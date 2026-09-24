import { describe, it, expect } from "vitest";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";

describe("Coin Multi page config (migration keeps every key and string)", () => {
  it("keeps the old storage keys and the legacy snapshot field", () => {
    expect(COIN_PAGE.storage).toEqual({
      save: "coin-multi-tracker.last-upload.v1",
      name: "coin-multi-tracker.playerName",
      snapshots: "coin-multi-tracker.v1",
      collapse: "coin-multi.snapshot-section.collapsed.v1",
      legacyValueKey: "computedCoinMulti",
      exportPrefix: "coin-multi-snapshots",
      exportLabel: "coin-multi-tracker",
    });
  });

  it("keeps the copy", () => {
    expect(COIN_PAGE).toMatchObject({
      statName: "Coin Multi",
      gainLabel: "Coin",
      emoji: "🪙",
      calculatorTitle: "Coin Multi Calculator",
      totalLabel: "Total Coin Multi",
      errPrefix: "Coin multi compute failed",
      mapTitle: "The map sets the guild bonus world and Coins For Charon's multikill tier",
    });
    expect(COIN_PAGE.formatTotal(6.885e35)).toBe("6.88E35");
  });
});
