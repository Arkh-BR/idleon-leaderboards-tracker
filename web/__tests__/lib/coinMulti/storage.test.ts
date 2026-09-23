import { describe, it, expect, beforeEach } from "vitest";
import {
  addSnapshot, listSnapshots, listTrackedChars, deleteSnapshot,
  exportAllAsJson, importFromJson, buildCoinSnapshot, type CoinSnapshot,
} from "@/lib/coinMulti/storage";

const snap = (charName: string, capturedAt: number, v = 2): CoinSnapshot => ({
  capturedAt, saveUpdatedAt: null, charIndex: 0, charName, level: 100,
  computedCoinMulti: v, mapName: "Spore Meadows",
});

beforeEach(() => localStorage.clear());

describe("coin multi snapshot storage", () => {
  it("keeps its own key, per character, oldest first", () => {
    addSnapshot(snap("A", 2));
    addSnapshot(snap("A", 1));
    addSnapshot(snap("B", 3));
    expect(listTrackedChars()).toEqual(["A", "B"]);
    expect(listSnapshots("A").map((s) => s.capturedAt)).toEqual([1, 2]);
    expect(localStorage.getItem("coin-multi-tracker.v1")).toBeTruthy();
    expect(localStorage.getItem("drop-rate-tracker.v1")).toBeNull();
  });

  it("deletes one snapshot", () => {
    addSnapshot(snap("A", 1));
    addSnapshot(snap("A", 2));
    deleteSnapshot("A", 1);
    expect(listSnapshots("A").map((s) => s.capturedAt)).toEqual([2]);
  });

  it("round-trips export → import, deduping by capturedAt", () => {
    addSnapshot(snap("A", 1));
    const text = exportAllAsJson();
    localStorage.clear();
    addSnapshot(snap("A", 1, 9));
    const res = importFromJson(text);
    expect(res).toMatchObject({ ok: true, charsImported: 1, snapshotsImported: 1 });
    expect(listSnapshots("A")).toHaveLength(1);
  });

  it("rejects a foreign file", () => {
    expect(importFromJson("{}")).toMatchObject({ ok: false, error: "Not a valid coin-multi-tracker export" });
  });

  it("builds a snapshot from a save", () => {
    const save = { charNames: ["Alpha"], lastUpdated: 5, data: { PVStatList_0: [1, 1, 1, 1, 321] } };
    expect(buildCoinSnapshot(save, 0, 7.5, "Map", { "Coin Multi": 7.5 })).toMatchObject({
      charIndex: 0, charName: "Alpha", level: 321, saveUpdatedAt: 5,
      computedCoinMulti: 7.5, mapName: "Map", flatTree: { "Coin Multi": 7.5 },
    });
  });
});
