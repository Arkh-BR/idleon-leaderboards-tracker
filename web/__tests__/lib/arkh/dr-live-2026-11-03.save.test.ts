import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE on 2026-11-03, the week Drop Rate (vote 27) won. V2 matched the game
// (1,680,226× on a later save) while V1 read the vote without its multi.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-11-03-markhe-weapon.json";

function find(n: ArkhNode, re: RegExp): ArkhNode | null {
  if (re.test(n.name)) return n;
  for (const c of n.children || []) {
    const hit = find(c, re);
    if (hit) return hit;
  }
  return null;
}

describe.skipIf(!existsSync(SAVE))("DR V1 with the Drop Rate vote active", () => {
  const load = () => JSON.parse(readFileSync(SAVE, "utf8"));

  it("V1's vote 27 carries VotingBonuszMulti, like V2", () => {
    const v1 = find(computeArkhDropRate(load(), 8, 150).tree, /^Voting Bonus \(DR\)$/)!;
    const v2 = find(computeArkhDropRateV2(load(), 8, 150).tree, /^Drop Rate \(Weekly Vote 27\)$/)!;
    expect(v2.val).toBeGreaterThan(38);
    expect(v1.val).toBeCloseTo(v2.val, 9);
  });

  it("V1 total = V2 total for every character", () => {
    const save = load();
    for (let ci = 0; ci < save.charNames.length; ci++) {
      const map = Number(save.data[`CurrentMap_${ci}`]);
      expect(computeArkhDropRate(load(), ci, map).total).toBeCloseTo(computeArkhDropRateV2(load(), ci, map).total, 6);
    }
  });
});
