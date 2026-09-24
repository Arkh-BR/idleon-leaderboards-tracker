import { describe, it, expect, beforeAll, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { talent } from "@/lib/arkh/stats/systems/common/talent";
import { computeMaxDamage, talentCalcTerms } from "@/lib/arkh/stats/systems/common/derived-damage";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// N.js reads these talents through GetTalentNumber (getbonus2 for 508/208)
// and applies each counter itself:
//   TotalStats("Weapon_Power") (~4164247): GTN(1,140)·floor(Lv0[10]/10),
//     170/320/500/530 alike, GTN(1,365)·getLOG(PetsStored[0][2])
//   DamageDealed (~4093018): getLOG(PlayerHPmax())·GTN(1,86), 446 with MP,
//     GTN(2,463)·floor(MinigameHiscores[0]/25), GTN(1,290)·floor(min(spd−1,10)/.15),
//     getLOG(OLA[161])·GTN(1,649), getLOG(OLA[71])·GTN(1,638)
//   WorkbenchStuff("AdditionExtraDMG") (~7770478): 1 + getbonus2(1,508,-1)·getLOG(OLA[152])/100,
//     same for 208 with OLA[329]
// talent.resolve returns their final bonus (the wrap), so max damage must
// read the bare "Talent Value" kid: stripping the wrap can't move it.
const GTN_IDS: [number, object?][] = [
  [86], [446], [140], [170], [320], [500], [530], [365], [290], [649], [638],
  [463, { tab: 2 }], [508, { mode: "max", tab: 1 }], [208, { mode: "max", tab: 1 }],
];

const tv = (n: { children?: { name: string; val: number }[] | null }) =>
  n.children?.find((k) => k.name === "Talent Value")?.val ?? NaN;

// Max damage with `id`'s final-bonus wrap replaced by its bare value.
function maxDamageUnwrapped(id: number, ci: number): number {
  const orig = talent.resolve;
  const spy = vi.spyOn(talent, "resolve").mockImplementation((tid, ctx, args) => {
    const n = orig.call(talent, tid, ctx, args);
    return tid === id && !isNaN(tv(n)) ? { ...n, val: tv(n) } : n;
  });
  try {
    return computeMaxDamage(ci, { saveData, charIdx: ci });
  } finally {
    spy.mockRestore();
  }
}

function expectBareGtn(id: number, args: object | undefined, ci: number) {
  const n = talent.resolve(id, { saveData, charIdx: ci }, args);
  expect(tv(n)).toBeGreaterThan(0);
  expect(n.val).not.toBeCloseTo(tv(n), 3); // the wrap applies a real counter
  expect(maxDamageUnwrapped(id, ci)).toBe(computeMaxDamage(ci, { saveData, charIdx: ci }));
}

describe("max damage reads each GetTalentNumber bare", () => {
  beforeAll(() => {
    const ola = new Array(440).fill(0);
    ola[71] = 1e4; // dungeon credits → 638
    ola[152] = 1e5; // wormhole kills → 508
    ola[161] = 1e3; // garbage → 649
    ola[329] = 1e7; // wraith bones → 208
    ola[438] = 50; // +50% move speed → 290
    const lv = Object.fromEntries(GTN_IDS.map(([id]) => [id, 100]));
    loadSaveData({
      charNames: ["T"],
      data: {
        CharacterClass_0: 1,
        // cooking 55, lab 95, sailing 75, divinity 85, gaming 65
        Lv0_0: JSON.stringify([100, 50, 60, 70, 80, 90, 55, 65, 75, 85, 55, 1, 95, 75, 85, 65]),
        SL_0: JSON.stringify({ ...lv, 656: 100 }),
        OptLacc: JSON.stringify(ola),
        PetsStored: JSON.stringify([["mushG", 1, 1e6]]),
        FamValMinigameHiscores: JSON.stringify([100]),
        WeeklyBoss: JSON.stringify({ d_0: -1, d_1: -1, d_2: -1 }),
      },
    });
  });

  it.each(GTN_IDS)("GetTalentNumber(%i) is not wrapped", (id, args) => expectBareGtn(id, args, 0));

  it("TalentCalc(656) = GTN × 3 dream clouds, once", () => {
    const n = talent.resolve(656, { saveData, charIdx: 0 });
    expect(tv(n)).toBeGreaterThan(0);
    expect(talentCalcTerms(0, { saveData, charIdx: 0 })[656]).toBeCloseTo(tv(n) * 3, 6);
  });
});

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-09-23: one holder per talent.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("max damage reads each GetTalentNumber bare, real save", () => {
  // Read in beforeAll: vitest still runs a skipped describe's body.
  let names: string[];
  beforeAll(() => {
    const save = JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
    loadSaveData(save);
    names = save.charNames;
  });

  const HOLDER: Record<number, string> = {
    86: "ARKHE", 446: "farkhe", 140: "ARKHE", 170: "zArkhe", 320: "ARKHELUCK",
    500: "Parkhe", 530: "farkhe", 365: "Darkhe", 290: "ARKHELUCK", 649: "ARKHELUCK",
    638: "ARKHE", 463: "farkhe", 508: "ARKHE", 208: "ARKHE",
  };
  it.each(GTN_IDS)("GetTalentNumber(%i) is not wrapped", (id, args) =>
    expectBareGtn(id, args, names.indexOf(HOLDER[id])));

  it("ARKHELUCK: TalentCalc(656) = GTN × 76 dream clouds, once", () => {
    const ci = names.indexOf("ARKHELUCK");
    const n = talent.resolve(656, { saveData, charIdx: ci });
    expect(talentCalcTerms(ci, { saveData, charIdx: ci })[656]).toBeCloseTo(tv(n) * 76, 6);
  });
});
