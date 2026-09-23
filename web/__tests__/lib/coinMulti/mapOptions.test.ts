import { describe, it, expect } from "vitest";
import { buildCoinMapOptions, worldOf } from "@/lib/coinMulti/mapOptions";

describe("coin multi map options", () => {
  it("world = ⌊map / 50⌋ + 1 (the guild term's factor)", () => {
    expect(worldOf(14)).toBe(1);
    expect(worldOf(50)).toBe(2);
    expect(worldOf(300)).toBe(7);
  });

  it("lists named maps with a world prefix, skips placeholders, keeps current maps", () => {
    const opts = buildCoinMapOptions({ data: { CurrentMap_0: 14, CurrentMap_1: 999 } });
    const byIdx = new Map(opts.map((o) => [o.index, o]));
    expect(byIdx.get(1)?.label).toBe("W1 · Spore Meadows");
    expect(byIdx.has(4)).toBe(false); // PlayerSelect
    expect(byIdx.has(44)).toBe(false); // Z
    expect(byIdx.has(56)).toBe(false); // Filler
    expect(byIdx.has(313)).toBe(false); // Unused
    expect(byIdx.get(999)?.label).toBe("W20 · Map 999"); // a char's map is always listed
    expect(opts.map((o) => o.index)).toEqual([...opts.map((o) => o.index)].sort((a, b) => a - b));
  });
});
