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
// Damage audit vs the 2026-11-03 in-game readings re-pinned every value five
// times, one commit each (the tag shows the last): Shrine(0) (0ce684a,
// ×1.0000012–1.0018509), Artifact 25 (×1.0088–1.346), TotalQuestsComplete
// (b5efd0e, ×1.0000–1.094; it moved 34 of the 43 pins), Mainframe 0/11
// (×1.0053–1.040), Artifact 2 (×1.0000004–1.037). A sixth re-pin, the review's
// active-char chips fix (chipBonuses is the current player's, not the sum over
// every character): only the 20 characters of 24632463 and 0celot8 moved
// (×0.9134–0.99983, Lab Chips (Damage), Weapon Power and their soft caps).
// Damage follow-ups: Artifact 8's getLOG(Σ PlayerBuildSpd) factor moved all 43
// (×1.00000009–1.0087); the leaf diff shows only the Artifact 8 leaf.
const CAPTURED: Record<string, Record<string, number>> = {
  "arkhe-live-2026-11-01-postupdate.json": {
    ARKHE: 3.03983067328636e+34, // Artifact 8 (damage follow-ups)
    ARKHELUCK: 2.6128256311665515e+34, // Artifact 8 (damage follow-ups)
    zArkhe: 4.081426702715002e+34, // Artifact 8 (damage follow-ups)
    farkhe: 5.445035383832085e+38, // Artifact 8 (damage follow-ups)
    Darkhe: 2.542513924919776e+34, // Artifact 8 (damage follow-ups)
    Parkhe: 2.8606192810978617e+34, // Artifact 8 (damage follow-ups)
    Warkhe: 1.4961154544223554e+38, // Artifact 8 (damage follow-ups)
    Sarkhe: 2.491859141684252e+34, // Artifact 8 (damage follow-ups)
    Markhe: 5.704421870555359e+38, // Artifact 8 (damage follow-ups)
    Barkhe: 2.55887287876842e+34, // Artifact 8 (damage follow-ups)
    Arkhiiiiii: 2.388358552739304e+34, // Artifact 8 (damage follow-ups)
  },
  "Arlong.json": {
    Arlong: 7.652146361415467e+32, // Artifact 8 (damage follow-ups)
    arlongarcher: 5.823399156515475e+32, // Artifact 8 (damage follow-ups)
    richardburnish: 7.963705994009427e+32, // Artifact 8 (damage follow-ups)
    forsenmods: 2.9705046616648184e+35, // Artifact 8 (damage follow-ups)
    borushiki: 1.0962714389554312e+35, // Artifact 8 (damage follow-ups)
    ArlongHunter: 9.877831347247575e+34, // Artifact 8 (damage follow-ups)
    MyWifeLeftMe: 4.61456547069131e+34, // Artifact 8 (damage follow-ups)
    ALTAddiciton: 1.0440065609321932e+35, // Artifact 8 (damage follow-ups)
    Arshort: 8.5054702659206e+32, // Artifact 8 (damage follow-ups)
    Valtan: 6.834926904532789e+32, // Artifact 8 (damage follow-ups)
    Synergism: 6.091662949179289e+31, // Artifact 8 (damage follow-ups)
  },
  "24632463.json": {
    "24632463": 1.4972482637392505e+32, // Artifact 8 (damage follow-ups)
    "246324633": 1.6734435749505637e+30, // Artifact 8 (damage follow-ups)
    "2463a": 5.915004480024054e+31, // Artifact 8 (damage follow-ups)
    "2463w": 6.810174557570251e+31, // Artifact 8 (damage follow-ups)
    "2463m": 1.1489691538137354e+31, // Artifact 8 (damage follow-ups)
    "2463a2": 1.0620848763919065e+32, // Artifact 8 (damage follow-ups)
    "2463w2": 8.887384237202666e+31, // Artifact 8 (damage follow-ups)
    "2463a3": 2.3571006989788384e+30, // Artifact 8 (damage follow-ups)
    "2463m2": 2.8407073365086076e+30, // Artifact 8 (damage follow-ups)
    "2463b": 5.9784393555703115e+29, // Artifact 8 (damage follow-ups)
    "2463w3": 9.881618232982626e+29, // Artifact 8 (damage follow-ups)
  },
  "0celot8.json": {
    "0celot8": 4.698514613551649e+23, // Artifact 8 (damage follow-ups)
    "0celot9": 7.376205569804181e+23, // Artifact 8 (damage follow-ups)
    "0celot10": 2.480656468574198e+22, // Artifact 8 (damage follow-ups)
    "0celot11": 5.9906800929427354e+23, // Artifact 8 (damage follow-ups)
    "0celot12": 5.1818209169882474e+22, // Artifact 8 (damage follow-ups)
    "0celot13": 7.107075359907036e+22, // Artifact 8 (damage follow-ups)
    "0celot14": 2.850260035875108e+22, // Artifact 8 (damage follow-ups)
    "0celot15": 1.247756353682655e+25, // Artifact 8 (damage follow-ups)
    "0celot16": 5.7916305195548184e+22, // Artifact 8 (damage follow-ups)
    "0celot17": 3.248171004795671e+22, // Artifact 8 (damage follow-ups)
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
