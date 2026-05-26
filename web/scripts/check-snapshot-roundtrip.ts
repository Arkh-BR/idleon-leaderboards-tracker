// Smoke-test the snapshot import/export round-trip end-to-end.
// Mocks a localStorage so the storage module can read/write, drops in
// two synthetic snapshots, exports → imports → confirms the merged
// store matches the original (and dedupes by capturedAt).

import {
  addSnapshot,
  exportAllAsJson,
  importFromJson,
  listSnapshots,
  listTrackedChars,
  clearAll,
} from "../lib/dropRate/storage";
import type { DropRateSnapshot } from "../lib/dropRate/extract";

// Minimal in-memory localStorage so the storage module thinks it's in a
// browser. Has to live on globalThis.window because the module reads
// `window.localStorage`.
const mem = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
  },
};

function mkSnap(charName: string, capturedAt: number): DropRateSnapshot {
  return {
    charName,
    capturedAt,
    luck: 100,
    dropRate: 1,
    dropRateBase: 1,
    accuracy: 1,
    money: 100,
    cashMulti: 1,
    classId: 0,
    mapName: "Town",
    timeAlive: 0,
  } as any;
}

clearAll();
console.log("[setup] cleared store");

addSnapshot(mkSnap("Alice", 1000));
addSnapshot(mkSnap("Alice", 2000));
addSnapshot(mkSnap("Bob", 1500));

console.log("[step 1] tracked chars =", listTrackedChars());
console.log("[step 1] Alice snaps   =", listSnapshots("Alice").length);
console.log("[step 1] Bob snaps     =", listSnapshots("Bob").length);

const json = exportAllAsJson();
console.log("[step 2] exported JSON length =", json.length);
console.log("[step 2] export shape OK      =", json.includes('"Alice"') && json.includes('"Bob"'));

// Now wipe and re-import
clearAll();
console.log("[step 3] cleared store; chars =", listTrackedChars());

const res = importFromJson(json);
console.log("[step 4] import result =", res);
console.log("[step 4] tracked chars =", listTrackedChars());
console.log("[step 4] Alice snaps   =", listSnapshots("Alice").length);
console.log("[step 4] Bob snaps     =", listSnapshots("Bob").length);

// Dedupe check: import the same JSON again, snaps should NOT double.
const res2 = importFromJson(json);
console.log("[step 5] re-import     =", res2);
console.log(
  "[step 5] Alice snaps after re-import =",
  listSnapshots("Alice").length
);
console.log(
  "[step 5] dedupe correct (no growth) =",
  listSnapshots("Alice").length === 2 && listSnapshots("Bob").length === 1
);

// Malformed JSON
const bad = importFromJson("{not json");
console.log("[step 6] malformed JSON rejected =", bad.ok === false);

const wrongShape = importFromJson('{"unrelated":true}');
console.log("[step 7] wrong-shape rejected   =", wrongShape.ok === false);

console.log("\nRoundtrip OK.");
