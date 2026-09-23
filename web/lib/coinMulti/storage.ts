// localStorage adapter for Coin Multi snapshots — own key, per character.
//   key 'coin-multi-tracker.v1' → { snapshotsByChar: { [charName]: CoinSnapshot[] } }

import { listCharacters } from "@/lib/dropRate/extract";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

const STORAGE_KEY = "coin-multi-tracker.v1";
const MAX_SNAPSHOTS_PER_CHAR = 500;

export type CoinSnapshot = {
  capturedAt: number;
  saveUpdatedAt: number | null;
  charIndex: number;
  charName: string;
  level: number;
  computedCoinMulti: number;
  mapName: string;
  /** Path → value for every node of the coin tree (for Δ comparisons). */
  flatTree?: FlatTree;
};

type Store = { snapshotsByChar: Record<string, CoinSnapshot[]> };

const emptyStore = (): Store => ({ snapshotsByChar: {} });

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded or storage disabled — silently drop
  }
}

export function buildCoinSnapshot(
  save: any,
  charIndex: number,
  computedCoinMulti: number,
  mapName: string,
  flatTree?: FlatTree
): CoinSnapshot {
  const ch = listCharacters(save).find((c) => c.charIndex === charIndex);
  if (!ch) throw new Error(`Character index ${charIndex} not present in save`);
  const updated = Number(save?.lastUpdated);
  return {
    capturedAt: Date.now(),
    saveUpdatedAt: Number.isFinite(updated) ? updated : null,
    charIndex: ch.charIndex,
    charName: ch.charName,
    level: ch.level,
    computedCoinMulti,
    mapName,
    flatTree,
  };
}

export function addSnapshot(snapshot: CoinSnapshot): void {
  const store = readStore();
  const list = store.snapshotsByChar[snapshot.charName] ?? [];
  list.push(snapshot);
  if (list.length > MAX_SNAPSHOTS_PER_CHAR) list.splice(0, list.length - MAX_SNAPSHOTS_PER_CHAR);
  store.snapshotsByChar[snapshot.charName] = list;
  writeStore(store);
}

export function listSnapshots(charName: string): CoinSnapshot[] {
  return [...(readStore().snapshotsByChar[charName] ?? [])].sort((a, b) => a.capturedAt - b.capturedAt);
}

export function listTrackedChars(): string[] {
  return Object.keys(readStore().snapshotsByChar).sort();
}

export function clearChar(charName: string): void {
  const store = readStore();
  delete store.snapshotsByChar[charName];
  writeStore(store);
}

export function deleteSnapshot(charName: string, capturedAt: number): void {
  const store = readStore();
  const list = store.snapshotsByChar[charName];
  if (!list) return;
  store.snapshotsByChar[charName] = list.filter((s) => s.capturedAt !== capturedAt);
  writeStore(store);
}

export function exportAllAsJson(): string {
  return JSON.stringify(readStore(), null, 2);
}

export function importFromJson(jsonText: string): {
  ok: boolean;
  charsImported: number;
  snapshotsImported: number;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || !parsed.snapshotsByChar || typeof parsed.snapshotsByChar !== "object") {
      return { ok: false, charsImported: 0, snapshotsImported: 0, error: "Not a valid coin-multi-tracker export" };
    }
    const incoming = parsed.snapshotsByChar as Record<string, CoinSnapshot[]>;
    const store = readStore();
    let chars = 0;
    let snaps = 0;
    for (const [charName, list] of Object.entries(incoming)) {
      if (!Array.isArray(list)) continue;
      const existing = new Map<number, CoinSnapshot>();
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
}
