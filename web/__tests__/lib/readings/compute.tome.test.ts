// A Tome reading counts on the save's logged-in character (computeTome's tomeWhere), not on the character the reading names:
// the game counts TomeQTY[15], the star talents, for the character logged in. The real-save proof is readings.save.test.ts
// (2026-11-03-tome-*: the save is on character 10, the reading says 0).
import { describe, expect, it, vi } from "vitest";

const computeTome = vi.hoisted(() => vi.fn(() => ({ totalPts: 7, rows: [{ computeIdx: 15, pts: 3 }] })));
vi.mock("@/lib/tome/compute", () => ({ computeTome }));

import { computeReadingValue } from "@/lib/readings/compute";
import type { Reading } from "@/lib/readings/types";

describe("Tome readings", () => {
  it("count on the save's logged-in character and map, not the reading's", async () => {
    const r = { id: "t", stat: "tomeScore", charIdx: 0, map: 0, task: 15 } as unknown as Reading;
    expect(await computeReadingValue(r, { data: {}, parsedData: {} })).toEqual({ value: 7 });
    expect(await computeReadingValue(r, { data: {} }, "tomeTask")).toEqual({ value: 3 });
    for (const call of computeTome.mock.calls as unknown[][]) {
      expect(call).toHaveLength(1); // no `where`: tomeWhere picks the latest PTimeAway
      expect(call[0]).not.toHaveProperty("parsedData");
    }
  });
});
