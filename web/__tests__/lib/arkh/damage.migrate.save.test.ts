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
    ARKHE: 2.7766433004483027e+34, // Shrine(0) fix (damage tracker)
    ARKHELUCK: 2.4222566861979766e+34, // Shrine(0) fix (damage tracker)
    zArkhe: 3.7550523106025958e+34, // Shrine(0) fix (damage tracker)
    farkhe: 5.040793690948821e+38, // Shrine(0) fix (damage tracker)
    Darkhe: 2.3583436315462295e+34, // Shrine(0) fix (damage tracker)
    Parkhe: 2.651286151873126e+34, // Shrine(0) fix (damage tracker)
    Warkhe: 1.4322393021274323e+38, // Shrine(0) fix (damage tracker)
    Sarkhe: 2.3313461875919606e+34, // Shrine(0) fix (damage tracker)
    Markhe: 5.251105390255521e+38, // Shrine(0) fix (damage tracker)
    Barkhe: 2.3721892246647354e+34, // Shrine(0) fix (damage tracker)
    Arkhiiiiii: 2.234790455964421e+34, // Shrine(0) fix (damage tracker)
  },
  "Arlong.json": {
    Arlong: 6.799089819357371e+32, // Shrine(0) fix (damage tracker)
    arlongarcher: 5.263709445513087e+32, // Shrine(0) fix (damage tracker)
    richardburnish: 7.178971459623794e+32, // Shrine(0) fix (damage tracker)
    forsenmods: 2.649701559267834e+35, // Shrine(0) fix (damage tracker)
    borushiki: 9.924158565383487e+34, // Shrine(0) fix (damage tracker)
    ArlongHunter: 8.932172079688155e+34, // Shrine(0) fix (damage tracker)
    MyWifeLeftMe: 4.321845405535764e+34, // Shrine(0) fix (damage tracker)
    ALTAddiciton: 9.298207159235843e+34, // Shrine(0) fix (damage tracker)
    Arshort: 7.596078529194678e+32, // Shrine(0) fix (damage tracker)
    Valtan: 6.202423449170888e+32, // Shrine(0) fix (damage tracker)
    Synergism: 5.74091791862191e+31, // Shrine(0) fix (damage tracker)
  },
  "24632463.json": {
    "24632463": 1.4644864190964117e+32, // Shrine(0) fix (damage tracker)
    "246324633": 1.7345665875061364e+30, // Shrine(0) fix (damage tracker)
    "2463a": 5.820717153496924e+31, // Shrine(0) fix (damage tracker)
    "2463w": 6.697249028442569e+31, // Shrine(0) fix (damage tracker)
    "2463m": 1.227366971257662e+31, // Shrine(0) fix (damage tracker)
    "2463a2": 1.0448900375656774e+32, // Shrine(0) fix (damage tracker)
    "2463w2": 8.691006526138615e+31, // Shrine(0) fix (damage tracker)
    "2463a3": 2.4051024505723876e+30, // Shrine(0) fix (damage tracker)
    "2463m2": 2.908902797537016e+30, // Shrine(0) fix (damage tracker)
    "2463b": 6.08208498086376e+29, // Shrine(0) fix (damage tracker)
    "2463w3": 1.0222081304053179e+30, // Shrine(0) fix (damage tracker)
  },
  "0celot8.json": {
    "0celot8": 3.3729893927194875e+23, // Shrine(0) fix (damage tracker)
    "0celot9": 5.369137329705921e+23, // Shrine(0) fix (damage tracker)
    "0celot10": 1.740183852498374e+22, // Shrine(0) fix (damage tracker)
    "0celot11": 4.599764441860788e+23, // Shrine(0) fix (damage tracker)
    "0celot12": 3.753670338917706e+22, // Shrine(0) fix (damage tracker)
    "0celot13": 5.011856980473535e+22, // Shrine(0) fix (damage tracker)
    "0celot14": 2.0124899326916406e+22, // Shrine(0) fix (damage tracker)
    "0celot15": 9.024306124094807e+24, // Shrine(0) fix (damage tracker)
    "0celot16": 4.297794162977383e+22, // Shrine(0) fix (damage tracker)
    "0celot17": 2.2907257936159097e+22, // Shrine(0) fix (damage tracker)
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
