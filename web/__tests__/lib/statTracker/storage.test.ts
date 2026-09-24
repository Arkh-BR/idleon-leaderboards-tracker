import { describe, it, expect, beforeEach } from "vitest";
import { createSnapshotStore, type StatSnapshot } from "@/lib/statTracker/storage";

const store = createSnapshotStore("test-stat-tracker.v1", "test-stat-tracker");
const legacy = createSnapshotStore("coin-multi-tracker.v1", "coin-multi-tracker", "computedCoinMulti");
const snap = (charName: string, capturedAt: number, value = 2): StatSnapshot => ({
  capturedAt, saveUpdatedAt: null, charIndex: 0, charName, level: 100, value, mapName: "Spore Meadows",
});

beforeEach(() => localStorage.clear());

describe("stat snapshot store", () => {
  it("keeps its own key, per character, oldest first", () => {
    store.addSnapshot(snap("A", 2));
    store.addSnapshot(snap("A", 1));
    store.addSnapshot(snap("B", 3));
    expect(store.listTrackedChars()).toEqual(["A", "B"]);
    expect(store.listSnapshots("A").map((s) => s.capturedAt)).toEqual([1, 2]);
    expect(localStorage.getItem("test-stat-tracker.v1")).toBeTruthy();
  });

  it("deletes one snapshot and clears a character", () => {
    store.addSnapshot(snap("A", 1));
    store.addSnapshot(snap("A", 2));
    store.deleteSnapshot("A", 1);
    expect(store.listSnapshots("A").map((s) => s.capturedAt)).toEqual([2]);
    store.clearChar("A");
    expect(store.listTrackedChars()).toEqual([]);
  });

  it("round-trips export → import, deduping by capturedAt", () => {
    store.addSnapshot(snap("A", 1));
    const text = store.exportAllAsJson();
    localStorage.clear();
    store.addSnapshot(snap("A", 1, 9));
    expect(store.importFromJson(text)).toMatchObject({ ok: true, charsImported: 1, snapshotsImported: 1 });
    expect(store.listSnapshots("A")).toHaveLength(1);
  });

  it("rejects a foreign file", () => {
    expect(store.importFromJson("{}")).toMatchObject({ ok: false, error: "Not a valid test-stat-tracker export" });
  });

  it("builds a snapshot from a save", () => {
    const save = { charNames: ["Alpha"], lastUpdated: 5, data: { PVStatList_0: [1, 1, 1, 1, 321] } };
    expect(store.buildSnapshot(save, 0, 7.5, "Map", { Root: 7.5 })).toMatchObject({
      charIndex: 0, charName: "Alpha", level: 321, saveUpdatedAt: 5, value: 7.5, mapName: "Map", flatTree: { Root: 7.5 },
    });
  });

  it("reads and keeps writing the legacy value field (Coin Multi's old snapshots)", () => {
    localStorage.setItem(
      "coin-multi-tracker.v1",
      JSON.stringify({ snapshotsByChar: { A: [{ capturedAt: 1, saveUpdatedAt: null, charIndex: 0, charName: "A", level: 1, computedCoinMulti: 42, mapName: "M" }] } })
    );
    expect(legacy.listSnapshots("A")[0].value).toBe(42);
    legacy.addSnapshot(snap("A", 2, 7));
    const stored = JSON.parse(localStorage.getItem("coin-multi-tracker.v1")!).snapshotsByChar.A[1];
    expect(stored).toMatchObject({ value: 7, computedCoinMulti: 7 });
  });
});
