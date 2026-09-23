import { describe, it, expect, beforeAll } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeAllTalentLVz, talent } from "@/lib/arkh/stats/systems/common/talent";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

function find(n: ArkhNode, re: RegExp): ArkhNode | null {
  if (re.test(n.name)) return n;
  for (const c of n.children || []) {
    const hit = find(c, re);
    if (hit) return hit;
  }
  return null;
}

// One Royal Guardian with no Armory 55 (cap 0) and two Spelunk super talents
// on preset 0: Royal Guardian talent 227 and plain talent 100.
beforeAll(() => {
  const spelunk: number[][] = Array.from({ length: 50 }, () => []);
  spelunk[20] = [227, 100];
  loadSaveData({
    charNames: ["Rg"],
    data: {
      CharacterClass_0: 16,
      Lv0_0: "[1900]",
      SL_0: JSON.stringify({ 227: 100, 100: 100 }),
      Spelunk: JSON.stringify(spelunk),
    },
  });
});

describe("Royal Guardian talent cap (Armory 55) spares super-talent levels", () => {
  // N.js: floor(min(AllTalMaxCapFR, rest) + AllTalMaxSUPERdn)
  it("adds the 50 super levels on top of the capped bonus", () => {
    expect(computeAllTalentLVz(100, 0, undefined, saveData)).toBe(50);
    expect(computeAllTalentLVz(227, 0, undefined, saveData)).toBe(50);
  });

  it("the breakdown tree agrees", () => {
    const t = talent.resolve(227, { saveData, charIdx: 0 });
    expect(find(t, /^Effective Level/)?.val).toBe(150);
  });
});
