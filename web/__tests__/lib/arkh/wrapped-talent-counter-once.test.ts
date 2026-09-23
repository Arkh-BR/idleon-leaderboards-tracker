import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeTotalStat } from "@/lib/arkh/stats/systems/common/stats";
import { computeSkillEfficiency } from "@/lib/arkh/stats/systems/common/derived-stats";
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

const term653 = (charIdx: number) => {
  const { tree } = computeTotalStat("LUK", charIdx, { saveData, charIdx });
  return find(tree, /^min\(15,LOG\(OLA172\)\*tal653\)/)!.val;
};

// N.js AllStatPCT: Math.min(15, getLOG(OLA[172]) * GetTalentNumber(1,653)).
// talent.resolve(653) already returns GTN × log10(OLA[172]) (its final-bonus
// wrap), so the term must take the bare GTN or it logs the counter twice.
describe("AllStatPCT's Dummy Thicc Stats term applies log10(OLA[172]) once", () => {
  // Talent 653 Lv 200 → GetTalentNumber(1,653) = 0.28; a best Target Dummy
  // DPS of 1000 → getLOG = 3. Far under the 15 cap, so a second log shows.
  beforeAll(() => {
    const ola: number[] = [];
    ola[172] = 1000;
    loadSaveData({
      charNames: ["Dummy"],
      data: { SL_0: JSON.stringify({ 653: 200 }), OptLacc: ola },
    });
  });

  it("is getLOG(1000) × 0.28 = 0.84, not 3 × 3 × 0.28 = 2.52", () => {
    expect(term653(0)).toBeCloseTo(0.84, 4);
  });
});

// N.js SkillStats (Mining): toolWP × (1 + GetTalentNumber(1,103) × (Lv0[1]/10)/100)
// × (1 + ToolW/100) + 4 — and resolve(103) already returns GTN × (Lv0[1]/10)/100.
describe("Mining tool power scales Tool Proficiency (103) by the level once", () => {
  // Copper Pickaxe (6 WP), Mining Lv 200, talent 103 Lv 40 → decay(16,40) = 8.
  beforeAll(() => {
    loadSaveData({
      charNames: ["Miner"],
      data: { EquipOrder_0: [[], ["EquipmentTools2"]], Lv0_0: [1, 200], SL_0: JSON.stringify({ 103: 40 }) },
    });
  });

  it("is 6 × (1 + 8 × 20/100) + 4 = 19.6, not 6 × (1 + 1.6 × 20/100) + 4 = 11.92", () => {
    const eff = computeSkillEfficiency("Mining", 0, { saveData, charIdx: 0 });
    expect(eff.children!.find((k) => k.name === "Tool Power")!.val).toBeCloseTo(19.6, 6);
  });
});

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23: 653 at Lv 200 on every char, OLA[172] = 3.74e43.
const SAVE = "scripts/updater/golden/.cache/arkhe-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("Dummy Thicc Stats on a real save", () => {
  let save: { charNames: string[] };
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    loadSaveData(save);
  });

  it("stays under the cap: 43.57 × 0.28 = 12.20 (the double log read 15)", () => {
    expect(term653(save.charNames.indexOf("Markhe"))).toBeCloseTo(12.2002, 4);
  });
});
