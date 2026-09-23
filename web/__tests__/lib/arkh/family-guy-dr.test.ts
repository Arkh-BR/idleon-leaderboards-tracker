import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23: Royal Guardians zArkhe (#2, Lv 1872) and Markhe (#8,
// Lv 1900), both with The Family Guy (talent 144) at raw Lv 409.
const SAVE = "scripts/updater/golden/.cache/arkhe-2026-09-23.json";

function find(n: ArkhNode, re: RegExp): ArkhNode | null {
  if (re.test(n.name)) return n;
  for (const c of n.children || []) {
    const hit = find(c, re);
    if (hit) return hit;
  }
  return null;
}

describe.skipIf(!existsSync(SAVE))("DR Royal Guardian family bonus honours The Family Guy", () => {
  // Read in beforeAll, not in the describe body: vitest still runs the body
  // of a skipped describe to collect its tests, so a top-level read would
  // throw ENOENT in CI where the private save is absent.
  let save: { charNames: string[] };
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
  });
  const rgFamily = (who: string) => {
    const { tree } = computeArkhDropRate(save, save.charNames.indexOf(who), 0);
    return find(tree, /^Royal Guardian Family Bonus/)!.val;
  };

  it("the active top Royal Guardian's value is buffed by its talent 144", () => {
    // decay(10,800) at 1900−129 = 6.888, × (1 + 34.83/100)
    expect(rgFamily("Markhe")).toBeCloseTo(9.2873, 3);
  });

  it("an earlier Royal Guardian keeps its own buffed value (N.js iteration order)", () => {
    expect(rgFamily("zArkhe")).toBeCloseTo(9.2326, 3);
  });

  it("a non-Royal-Guardian character sees the account's unbuffed best value", () => {
    expect(rgFamily("Darkhe")).toBeCloseTo(6.8884, 3);
  });
});

describe.skipIf(!existsSync(SAVE))("DR total matches the in-game reading", () => {
  let save: { charNames: string[]; extraData: { totalTomePoints: number } };
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    // This export carries IdleonToolbox's Tome count (52,722); signed-in
    // saves get our computeTome stamp, 53,011 for this account state.
    save.extraData.totalTomePoints = 53011;
  });

  it("Markhe on map 14 reads 363,893.46× in game", () => {
    // −0.21% with 1.4·LUK inside the /100, −0.005% with getbonus2's bonus
    // levels on the reference char instead of the active one.
    const dr = computeArkhDropRate(save, save.charNames.indexOf("Markhe"), 14).total;
    expect(Math.abs(dr / 363893.46 - 1)).toBeLessThan(1e-5);
  });
});
