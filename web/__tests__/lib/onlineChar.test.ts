import { describe, it, expect } from "vitest";
import { onlineCharIndex, defaultCharIndex, listCharacters } from "@/lib/dropRate/extract";

// Fixed epoch so every case is deterministic regardless of when the suite runs.
const NOW = 1_700_000_000_000;

// PTimeAway is stored in thousands of seconds; ×1e6 turns it into the same
// Unix-ms scale as lastUpdated (mirrors onlineCharIndex's own conversion).
const pTimeAwayForMs = (activityMs: number) => activityMs / 1_000_000;

describe("onlineCharIndex", () => {
  it("picks the character whose activity sits seconds from lastUpdated, ignoring the others 11h earlier", () => {
    const lastUpdated = NOW - 60_000; // save is 1 min old
    const onlineActivityMs = lastUpdated - 7_000; // 7s before lastUpdated
    const save = {
      charNames: ["Alpha", "Beta", "Gamma"],
      lastUpdated,
      data: {
        PTimeAway_0: pTimeAwayForMs(onlineActivityMs - 11 * 3_600_000),
        PTimeAway_1: pTimeAwayForMs(onlineActivityMs),
        PTimeAway_2: pTimeAwayForMs(onlineActivityMs - 11 * 3_600_000),
      },
    };
    expect(onlineCharIndex(save, NOW)).toBe(1);
  });

  it("returns null once the save itself is more than 10 min old", () => {
    const lastUpdated = NOW - 60_000;
    const onlineActivityMs = lastUpdated - 7_000;
    const save = {
      charNames: ["Alpha", "Beta"],
      lastUpdated,
      data: {
        PTimeAway_0: pTimeAwayForMs(onlineActivityMs - 11 * 3_600_000),
        PTimeAway_1: pTimeAwayForMs(onlineActivityMs),
      },
    };
    expect(onlineCharIndex(save, lastUpdated + 11 * 60_000)).toBeNull();
  });

  it("returns null when the leading character is 20 min away from lastUpdated", () => {
    const lastUpdated = NOW - 60_000;
    const bestActivityMs = lastUpdated - 20 * 60_000; // 20 min before lastUpdated
    const save = {
      charNames: ["Alpha", "Beta"],
      lastUpdated,
      data: {
        PTimeAway_0: pTimeAwayForMs(bestActivityMs),
        PTimeAway_1: pTimeAwayForMs(bestActivityMs - 3_600_000), // even earlier
      },
    };
    expect(onlineCharIndex(save, NOW)).toBeNull();
  });

  it("returns null when lastUpdated is missing", () => {
    const save = { charNames: ["Alpha"], data: { PTimeAway_0: 123 } };
    expect(onlineCharIndex(save, NOW)).toBeNull();
  });

  it("still picks the character when its activity is 56s AFTER lastUpdated (paste lag)", () => {
    const lastUpdated = NOW - 30_000;
    const onlineActivityMs = lastUpdated + 56_000; // 56s after lastUpdated
    const save = {
      charNames: ["Alpha", "Beta"],
      lastUpdated,
      data: {
        PTimeAway_0: pTimeAwayForMs(onlineActivityMs - 11 * 3_600_000),
        PTimeAway_1: pTimeAwayForMs(onlineActivityMs),
      },
    };
    expect(onlineCharIndex(save, NOW)).toBe(1);
  });
});

describe("defaultCharIndex", () => {
  it("falls back to list[0].charIndex when nobody is online", () => {
    const save = {
      charNames: ["Alpha", "Beta"],
      // no lastUpdated ⇒ onlineCharIndex is always null
      data: {
        PVStatList_0: [1, 1, 1, 1, 100],
        PVStatList_1: [1, 1, 1, 1, 90],
      },
    };
    const list = listCharacters(save);
    expect(defaultCharIndex(save, list)).toBe(list[0].charIndex);
  });
});
