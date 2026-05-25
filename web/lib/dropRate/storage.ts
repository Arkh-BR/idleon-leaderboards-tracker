// localStorage adapter for Drop Rate snapshots.
// Keyed per-character so the user can track multiple chars separately.
//
// Schema (versioned):
//   key 'drop-rate-tracker.v1' → { snapshotsByChar: { [charName]: DropRateSnapshot[] } }
//
// Hard cap of MAX_SNAPSHOTS_PER_CHAR per char to keep us well under the
// ~5-10MB localStorage budget even for high-frequency users.

import type { DropRateSnapshot } from "./extract";

const STORAGE_KEY = "drop-rate-tracker.v1";
const MAX_SNAPSHOTS_PER_CHAR = 500;

type Store = {
  snapshotsByChar: Record<string, DropRateSnapshot[]>;
};

function emptyStore(): Store {
  return { snapshotsByChar: {} };
}

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.snapshotsByChar &&
      typeof parsed.snapshotsByChar === "object"
    ) {
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

export function addSnapshot(snapshot: DropRateSnapshot): void {
  const store = readStore();
  const list = store.snapshotsByChar[snapshot.charName] ?? [];
  list.push(snapshot);
  // Keep newest only if we hit the cap
  if (list.length > MAX_SNAPSHOTS_PER_CHAR) {
    list.splice(0, list.length - MAX_SNAPSHOTS_PER_CHAR);
  }
  store.snapshotsByChar[snapshot.charName] = list;
  writeStore(store);
}

export function listSnapshots(charName: string): DropRateSnapshot[] {
  const store = readStore();
  return [...(store.snapshotsByChar[charName] ?? [])].sort(
    (a, b) => a.capturedAt - b.capturedAt
  );
}

export function listTrackedChars(): string[] {
  const store = readStore();
  return Object.keys(store.snapshotsByChar).sort();
}

export function clearChar(charName: string): void {
  const store = readStore();
  delete store.snapshotsByChar[charName];
  writeStore(store);
}

export function clearAll(): void {
  writeStore(emptyStore());
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
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.snapshotsByChar ||
      typeof parsed.snapshotsByChar !== "object"
    ) {
      return {
        ok: false,
        charsImported: 0,
        snapshotsImported: 0,
        error: "Not a valid drop-rate-tracker export",
      };
    }
    const incoming = parsed.snapshotsByChar as Record<string, DropRateSnapshot[]>;
    const store = readStore();
    let chars = 0;
    let snaps = 0;
    for (const [charName, list] of Object.entries(incoming)) {
      if (!Array.isArray(list)) continue;
      // Merge: dedupe by capturedAt
      const existing = new Map<number, DropRateSnapshot>();
      for (const s of store.snapshotsByChar[charName] ?? []) {
        existing.set(s.capturedAt, s);
      }
      for (const s of list) {
        if (s && typeof s.capturedAt === "number") {
          existing.set(s.capturedAt, s);
          snaps++;
        }
      }
      const merged = [...existing.values()].sort(
        (a, b) => a.capturedAt - b.capturedAt
      );
      if (merged.length > MAX_SNAPSHOTS_PER_CHAR) {
        merged.splice(0, merged.length - MAX_SNAPSHOTS_PER_CHAR);
      }
      store.snapshotsByChar[charName] = merged;
      chars++;
    }
    writeStore(store);
    return { ok: true, charsImported: chars, snapshotsImported: snaps };
  } catch (e) {
    return {
      ok: false,
      charsImported: 0,
      snapshotsImported: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
