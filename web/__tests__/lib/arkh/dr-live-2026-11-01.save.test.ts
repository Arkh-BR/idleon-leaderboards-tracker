import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE after the 2026-11-01 update (The Cape Vine), saved 2026-11-02T01:43Z at
// the moment of an in-game reading of Markhe (#8, online) on map 100: 22 capes
// in Spelunk[54], his cape slot (12) empty, KLA_8[100] = [0,0] (system ON).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-11-01-postupdate.json";

function find(n: ArkhNode, re: RegExp): ArkhNode | null {
  if (re.test(n.name)) return n;
  for (const c of n.children || []) {
    const hit = find(c, re);
    if (hit) return hit;
  }
  return null;
}

describe.skipIf(!existsSync(SAVE))("DR matches the in-game reading (post Cape Vine update)", () => {
  const load = () => JSON.parse(readFileSync(SAVE, "utf8"));

  // The character panel shows Math.floor(DR) once DR > 9999.
  it("V1: Markhe on map 100 reads 462,577× in game", () => {
    const { total, tree } = computeArkhDropRate(load(), 8, 100);
    expect(Math.floor(total)).toBe(462577);
    expect(find(tree, /^Cape Vine/)!.val).toBeGreaterThan(0);
  });

  it("V2: the same 462,577×", () => {
    expect(Math.floor(computeArkhDropRateV2(load(), 8, 100).total)).toBe(462577);
  });
});
