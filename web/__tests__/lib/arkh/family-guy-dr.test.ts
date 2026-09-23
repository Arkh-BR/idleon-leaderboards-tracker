import { describe, it, expect } from "vitest";
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
  const save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
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
