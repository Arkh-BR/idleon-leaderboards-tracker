import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { currentMapData } from "@/lib/arkh/save/data";
import type { ArkhNode } from "@/lib/arkh/node";
import { computeMaxDamage } from "@/lib/arkh/stats/systems/damage/damage";
import { computeArkhDamage } from "@/lib/arkh/computeDamage";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Regression pin of the Task 4 values: max damage with every N.js term wired
// (Task 3: the terms that already had a port elsewhere; Task 4: divinity
// blessings 7/8, eclipse skulls, Killroy, sticker). Captured 2026-11-02 with
// computeMaxDamage(ci, { saveData, charIdx: ci }) (no map: map 43/306
// neutral), per character. Earlier pins are in git history; per-save
// before → after is in the Task 3 and Task 4 commit bodies. Saves (gitignored golden cache): ARKHE
// post-update, then by account level (Σ character levels) the strongest
// (Arlong 20922), a middle one (24632463 18198) and the weakest (0celot8 9753).
const DIR = "scripts/updater/golden/.cache/";
// HP/accuracy fix (damage tracker): re-pinned after PlayerHPmax gained
// Shrine(1) and FamBonusQTYs["18"] (Max HP ×3.0–4.0). Only the two Max HP
// readers moved — Big Meaty Claws (bdmgHP × log10(HP − 250)) and Meat Shank
// (GTN 86 × log10(HP)) — by ×1.000000–1.000789; the accuracy fix moves no pin.
const CAPTURED: Record<string, Record<string, number>> = {
  "arkhe-live-2026-11-01-postupdate.json": {
    ARKHE: 3.0398243846386274e+34, // Mainframe 0/11 fix (damage tracker)
    ARKHELUCK: 2.6128180530334916e+34, // Mainframe 0/11 fix (damage tracker)
    zArkhe: 4.081417310817213e+34, // Mainframe 0/11 fix (damage tracker)
    farkhe: 5.445019983031662e+38, // Mainframe 0/11 fix (damage tracker)
    Darkhe: 2.542506374596657e+34, // Mainframe 0/11 fix (damage tracker)
    Parkhe: 2.860610929612826e+34, // Mainframe 0/11 fix (damage tracker)
    Warkhe: 1.4959827765238092e+38, // Mainframe 0/11 fix (damage tracker)
    Sarkhe: 2.491849852083122e+34, // Mainframe 0/11 fix (damage tracker)
    Markhe: 5.704408582940333e+38, // Mainframe 0/11 fix (damage tracker)
    Barkhe: 2.5588654245336404e+34, // Mainframe 0/11 fix (damage tracker)
    Arkhiiiiii: 2.3883496259952656e+34, // Mainframe 0/11 fix (damage tracker)
  },
  "Arlong.json": {
    Arlong: 7.65214281616001e+32, // Mainframe 0/11 fix (damage tracker)
    arlongarcher: 5.8233835266990104e+32, // Mainframe 0/11 fix (damage tracker)
    richardburnish: 7.963685595842404e+32, // Mainframe 0/11 fix (damage tracker)
    forsenmods: 2.9705032566355574e+35, // Mainframe 0/11 fix (damage tracker)
    borushiki: 1.0962683779725336e+35, // Mainframe 0/11 fix (damage tracker)
    ArlongHunter: 9.877804228804037e+34, // Mainframe 0/11 fix (damage tracker)
    MyWifeLeftMe: 4.61449181232706e+34, // Mainframe 0/11 fix (damage tracker)
    ALTAddiciton: 1.044006054042157e+35, // Mainframe 0/11 fix (damage tracker)
    Arshort: 8.50546614371959e+32, // Mainframe 0/11 fix (damage tracker)
    Valtan: 6.834906778943985e+32, // Mainframe 0/11 fix (damage tracker)
    Synergism: 6.091563587574395e+31, // Mainframe 0/11 fix (damage tracker)
  },
  "24632463.json": {
    "24632463": 1.503648574023905e+32, // Mainframe 0/11 fix (damage tracker)
    "246324633": 1.7806871371830683e+30, // Mainframe 0/11 fix (damage tracker)
    "2463a": 5.968090173285271e+31, // Mainframe 0/11 fix (damage tracker)
    "2463w": 6.878110965879839e+31, // Mainframe 0/11 fix (damage tracker)
    "2463m": 1.2578850552953318e+31, // Mainframe 0/11 fix (damage tracker)
    "2463a2": 1.0723051269780529e+32, // Mainframe 0/11 fix (damage tracker)
    "2463w2": 8.930663182267763e+31, // Mainframe 0/11 fix (damage tracker)
    "2463a3": 2.4686081574318196e+30, // Mainframe 0/11 fix (damage tracker)
    "2463m2": 2.988312655575354e+30, // Mainframe 0/11 fix (damage tracker)
    "2463b": 6.453813692016693e+29, // Mainframe 0/11 fix (damage tracker)
    "2463w3": 1.0457500658137743e+30, // Mainframe 0/11 fix (damage tracker)
  },
  "0celot8.json": {
    "0celot8": 4.676381950535825e+23, // Mainframe 0/11 fix (damage tracker)
    "0celot9": 7.371219227001434e+23, // Mainframe 0/11 fix (damage tracker)
    "0celot10": 2.4485788025155918e+22, // Mainframe 0/11 fix (damage tracker)
    "0celot11": 5.9848619150977984e+23, // Mainframe 0/11 fix (damage tracker)
    "0celot12": 5.117944392433925e+22, // Mainframe 0/11 fix (damage tracker)
    "0celot13": 7.005484922858628e+22, // Mainframe 0/11 fix (damage tracker)
    "0celot14": 2.7254339290328604e+22, // Mainframe 0/11 fix (damage tracker)
    "0celot15": 1.2472189062250096e+25, // Mainframe 0/11 fix (damage tracker)
    "0celot16": 5.71265408810718e+22, // Mainframe 0/11 fix (damage tracker)
    "0celot17": 3.202833008871381e+22, // Mainframe 0/11 fix (damage tracker)
  },
};

const close = (actual: number, expected: number) => expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);

/** Every node whose val is NaN (flattenTree would read it as 0 and hide it). */
const nanPaths = (n: ArkhNode, path = n.name): string[] => [
  ...(Number.isNaN(n.val) ? [path] : []),
  ...(n.children ?? []).flatMap((k) => nanPaths(k, `${path} / ${k.name}`)),
];

for (const [file, want] of Object.entries(CAPTURED)) {
  describe.skipIf(!existsSync(DIR + file))(`max damage, Task 4 value — ${file}`, () => {
    // Read in beforeAll: vitest still runs a skipped describe's body.
    let save: any;
    beforeAll(() => {
      save = JSON.parse(readFileSync(DIR + file, "utf8").replace(/^﻿/, ""));
    });

    it.each(Object.entries(want))("%s: pinned Max, finite, page total = Max on its map, tree without NaN", (name, pinned) => {
      const ci = save.charNames.indexOf(name);
      expect(ci).toBeGreaterThanOrEqual(0);
      loadSaveData(save);
      const max = computeMaxDamage(ci, { saveData, charIdx: ci });
      expect(Number.isFinite(max) && max > 0).toBe(true);
      close(max, pinned);

      const map = Number(currentMapData[ci]) || 0;
      const r = computeArkhDamage(save, ci, map);
      expect(r.total).toBe(computeMaxDamage(ci, { saveData, charIdx: ci }, map));
      expect(nanPaths(r.tree)).toEqual([]);
    });
  });
}
