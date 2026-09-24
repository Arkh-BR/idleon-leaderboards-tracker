// localStorage adapter for a stat page's snapshots — one key per stat,
// snapshots per character: key → { snapshotsByChar: { [charName]: StatSnapshot[] } }.

import { listCharacters } from "@/lib/dropRate/extract";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

const MAX_SNAPSHOTS_PER_CHAR = 500;

export type StatSnapshot = {
  capturedAt: number;
  saveUpdatedAt: number | null;
  charIndex: number;
  charName: string;
  level: number;
  /** The stat's total at capture time. */
  value: number;
  mapName: string;
  /** Path → value for every node of the tree (for Δ comparisons). */
  flatTree?: FlatTree;
};

type Store = { snapshotsByChar: Record<string, StatSnapshot[]> };

export type SnapshotStore = {
  buildSnapshot(save: any, charIndex: number, value: number, mapName: string, flatTree?: FlatTree): StatSnapshot;
  addSnapshot(snapshot: StatSnapshot): void;
  listSnapshots(charName: string): StatSnapshot[];
  listTrackedChars(): string[];
  clearChar(charName: string): void;
  deleteSnapshot(charName: string, capturedAt: number): void;
  exportAllAsJson(): string;
  importFromJson(jsonText: string): { ok: boolean; charsImported: number; snapshotsImported: number; error?: string };
};

/** legacyValueKey: the field an older release stored the value under (Coin
 *  Multi: "computedCoinMulti"). Read as a fallback and written next to
 *  `value`, so old snapshots, old exports and an older app all keep working. */
export function createSnapshotStore(storageKey: string, exportLabel: string, legacyValueKey?: string): SnapshotStore {
  const emptyStore = (): Store => ({ snapshotsByChar: {} });

  function readStore(): Store {
    if (typeof window === "undefined") return emptyStore();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.snapshotsByChar && typeof parsed.snapshotsByChar === "object") {
        return parsed as Store;
      }
    } catch {
      // corrupt store — fall through to fresh
    }
    return emptyStore();
  }

  function writeStore(store: Store): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      // quota exceeded or storage disabled — silently drop
    }
  }

  const normalize = (s: StatSnapshot): StatSnapshot =>
    typeof s.value === "number" || !legacyValueKey ? s : { ...s, value: Number((s as any)[legacyValueKey]) };
  const withLegacy = (s: StatSnapshot): StatSnapshot =>
    legacyValueKey ? ({ ...s, [legacyValueKey]: s.value } as StatSnapshot) : s;

  return {
    buildSnapshot(save, charIndex, value, mapName, flatTree) {
      const ch = listCharacters(save).find((c) => c.charIndex === charIndex);
      if (!ch) throw new Error(`Character index ${charIndex} not present in save`);
      const updated = Number(save?.lastUpdated);
      return {
        capturedAt: Date.now(),
        saveUpdatedAt: Number.isFinite(updated) ? updated : null,
        charIndex: ch.charIndex,
        charName: ch.charName,
        level: ch.level,
        value,
        mapName,
        flatTree,
      };
    },
    addSnapshot(snapshot) {
      const store = readStore();
      const list = store.snapshotsByChar[snapshot.charName] ?? [];
      list.push(withLegacy(snapshot));
      if (list.length > MAX_SNAPSHOTS_PER_CHAR) list.splice(0, list.length - MAX_SNAPSHOTS_PER_CHAR);
      store.snapshotsByChar[snapshot.charName] = list;
      writeStore(store);
    },
    listSnapshots(charName) {
      return [...(readStore().snapshotsByChar[charName] ?? [])].map(normalize).sort((a, b) => a.capturedAt - b.capturedAt);
    },
    listTrackedChars() {
      return Object.keys(readStore().snapshotsByChar).sort();
    },
    clearChar(charName) {
      const store = readStore();
      delete store.snapshotsByChar[charName];
      writeStore(store);
    },
    deleteSnapshot(charName, capturedAt) {
      const store = readStore();
      const list = store.snapshotsByChar[charName];
      if (!list) return;
      store.snapshotsByChar[charName] = list.filter((s) => s.capturedAt !== capturedAt);
      writeStore(store);
    },
    exportAllAsJson() {
      return JSON.stringify(readStore(), null, 2);
    },
    importFromJson(jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || !parsed.snapshotsByChar || typeof parsed.snapshotsByChar !== "object") {
          return { ok: false, charsImported: 0, snapshotsImported: 0, error: `Not a valid ${exportLabel} export` };
        }
        const incoming = parsed.snapshotsByChar as Record<string, StatSnapshot[]>;
        const store = readStore();
        let chars = 0;
        let snaps = 0;
        for (const [charName, list] of Object.entries(incoming)) {
          if (!Array.isArray(list)) continue;
          const existing = new Map<number, StatSnapshot>();
          for (const s of store.snapshotsByChar[charName] ?? []) existing.set(s.capturedAt, s);
          for (const s of list) {
            if (s && typeof s.capturedAt === "number") {
              existing.set(s.capturedAt, s);
              snaps++;
            }
          }
          const merged = [...existing.values()].sort((a, b) => a.capturedAt - b.capturedAt);
          if (merged.length > MAX_SNAPSHOTS_PER_CHAR) merged.splice(0, merged.length - MAX_SNAPSHOTS_PER_CHAR);
          store.snapshotsByChar[charName] = merged;
          chars++;
        }
        writeStore(store);
        return { ok: true, charsImported: chars, snapshotsImported: snaps };
      } catch (e) {
        return { ok: false, charsImported: 0, snapshotsImported: 0, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
