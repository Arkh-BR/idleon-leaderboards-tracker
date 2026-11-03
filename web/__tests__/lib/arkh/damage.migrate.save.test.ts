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
    ARKHE: 3.006879130791436e+34, // TotalQuestsComplete fix (damage tracker)
    ARKHELUCK: 2.584992938853048e+34, // TotalQuestsComplete fix (damage tracker)
    zArkhe: 4.0371484887291418e+34, // TotalQuestsComplete fix (damage tracker)
    farkhe: 5.38662909113813e+38, // TotalQuestsComplete fix (damage tracker)
    Darkhe: 2.5150389851942507e+34, // TotalQuestsComplete fix (damage tracker)
    Parkhe: 2.8296110254381272e+34, // TotalQuestsComplete fix (damage tracker)
    Warkhe: 1.479921473119152e+38, // TotalQuestsComplete fix (damage tracker)
    Sarkhe: 2.4648221679794434e+34, // TotalQuestsComplete fix (damage tracker)
    Markhe: 5.642554398948841e+38, // TotalQuestsComplete fix (damage tracker)
    Barkhe: 2.531110860469395e+34, // TotalQuestsComplete fix (damage tracker)
    Arkhiiiiii: 2.362444550227328e+34, // TotalQuestsComplete fix (damage tracker)
  },
  "Arlong.json": {
    Arlong: 7.56684494333127e+32, // TotalQuestsComplete fix (damage tracker)
    arlongarcher: 5.758484461025919e+32, // TotalQuestsComplete fix (damage tracker)
    richardburnish: 7.875098132489125e+32, // TotalQuestsComplete fix (damage tracker)
    forsenmods: 2.937489284051663e+35, // TotalQuestsComplete fix (damage tracker)
    borushiki: 1.0841044559162312e+35, // TotalQuestsComplete fix (damage tracker)
    ArlongHunter: 9.76500602680819e+34, // TotalQuestsComplete fix (damage tracker)
    MyWifeLeftMe: 4.562988883842927e+34, // TotalQuestsComplete fix (damage tracker)
    ALTAddiciton: 1.0322091158923108e+35, // TotalQuestsComplete fix (damage tracker)
    Arshort: 8.41038414589813e+32, // TotalQuestsComplete fix (damage tracker)
    Valtan: 6.757528946161598e+32, // TotalQuestsComplete fix (damage tracker)
    Synergism: 6.023433834227347e+31, // TotalQuestsComplete fix (damage tracker)
  },
  "24632463.json": {
    "24632463": 1.4828237175122894e+32, // Artifact 25 fix (damage tracker)
    "246324633": 1.755942429510752e+30, // Artifact 25 fix (damage tracker)
    "2463a": 5.885055043831627e+31, // Artifact 25 fix (damage tracker)
    "2463w": 6.782560889118114e+31, // Artifact 25 fix (damage tracker)
    "2463m": 1.2426262876273002e+31, // TotalQuestsComplete fix (damage tracker)
    "2463a2": 1.0573905182164219e+32, // Artifact 25 fix (damage tracker)
    "2463w2": 8.806409233028538e+31, // Artifact 25 fix (damage tracker)
    "2463a3": 2.434335446564243e+30, // Artifact 25 fix (damage tracker)
    "2463m2": 2.9467357153819265e+30, // Artifact 25 fix (damage tracker)
    "2463b": 6.2082049787808875e+29, // TotalQuestsComplete fix (damage tracker)
    "2463w3": 1.0312314839410354e+30, // Artifact 25 fix (damage tracker)
  },
  "0celot8.json": {
    "0celot8": 4.649923046049143e+23, // TotalQuestsComplete fix (damage tracker)
    "0celot9": 7.32885014050492e+23, // TotalQuestsComplete fix (damage tracker)
    "0celot10": 2.4174533443441083e+22, // TotalQuestsComplete fix (damage tracker)
    "0celot11": 5.951367739631195e+23, // TotalQuestsComplete fix (damage tracker)
    "0celot12": 5.053585152325002e+22, // TotalQuestsComplete fix (damage tracker)
    "0celot13": 6.918045248824736e+22, // TotalQuestsComplete fix (damage tracker)
    "0celot14": 2.691607176601475e+22, // TotalQuestsComplete fix (damage tracker)
    "0celot15": 1.240624278493495e+25, // TotalQuestsComplete fix (damage tracker)
    "0celot16": 5.64081624705835e+22, // TotalQuestsComplete fix (damage tracker)
    "0celot17": 3.162712340833642e+22, // TotalQuestsComplete fix (damage tracker)
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
