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
    ARKHE: 3.0398294088711956e+34, // Artifact 2 fix (damage tracker)
    ARKHELUCK: 2.6128241074905007e+34, // Artifact 2 fix (damage tracker)
    zArkhe: 4.08142481435313e+34, // Artifact 2 fix (damage tracker)
    farkhe: 5.445032287312136e+38, // Artifact 2 fix (damage tracker)
    Darkhe: 2.5425124068358396e+34, // Artifact 2 fix (damage tracker)
    Parkhe: 2.8606176019301463e+34, // Artifact 2 fix (damage tracker)
    Warkhe: 1.4960887906657862e+38, // Artifact 2 fix (damage tracker)
    Sarkhe: 2.4918572739052945e+34, // Artifact 2 fix (damage tracker)
    Markhe: 5.704419198909841e+38, // Artifact 2 fix (damage tracker)
    Barkhe: 2.558871380003735e+34, // Artifact 2 fix (damage tracker)
    Arkhiiiiii: 2.3883567579169484e+34, // Artifact 2 fix (damage tracker)
  },
  "Arlong.json": {
    Arlong: 7.652145650382707e+32, // Artifact 2 fix (damage tracker)
    arlongarcher: 5.823396021854509e+32, // Artifact 2 fix (damage tracker)
    richardburnish: 7.963701903022063e+32, // Artifact 2 fix (damage tracker)
    forsenmods: 2.9705043798736206e+35, // Artifact 2 fix (damage tracker)
    borushiki: 1.0962708250558478e+35, // Artifact 2 fix (damage tracker)
    ArlongHunter: 9.877825908469871e+34, // Artifact 2 fix (damage tracker)
    MyWifeLeftMe: 4.6145506941169005e+34, // Artifact 2 fix (damage tracker)
    ALTAddiciton: 1.0440064592708654e+35, // Artifact 2 fix (damage tracker)
    Arshort: 8.505469439176334e+32, // Artifact 2 fix (damage tracker)
    Valtan: 6.834922868221416e+32, // Artifact 2 fix (damage tracker)
    Synergism: 6.091643023080177e+31, // Artifact 2 fix (damage tracker)
  },
  "24632463.json": {
    "24632463": 1.5036663928508902e+32, // Artifact 2 fix (damage tracker)
    "246324633": 1.7807085411022898e+30, // Artifact 2 fix (damage tracker)
    "2463a": 5.968169103977567e+31, // Artifact 2 fix (damage tracker)
    "2463w": 6.878190713349689e+31, // Artifact 2 fix (damage tracker)
    "2463m": 1.2579013586053175e+31, // Artifact 2 fix (damage tracker)
    "2463a2": 1.0723181459030647e+32, // Artifact 2 fix (damage tracker)
    "2463w2": 8.930762136221822e+31, // Artifact 2 fix (damage tracker)
    "2463a3": 2.4686376173500797e+30, // Artifact 2 fix (damage tracker)
    "2463m2": 2.988346631638664e+30, // Artifact 2 fix (damage tracker)
    "2463b": 6.458742939828733e+29, // Artifact 2 fix (damage tracker)
    "2463w3": 1.0457680516133229e+30, // Artifact 2 fix (damage tracker)
  },
  "0celot8.json": {
    "0celot8": 4.694768736468319e+23, // Artifact 2 fix (damage tracker)
    "0celot9": 7.376199930758121e+23, // Artifact 2 fix (damage tracker)
    "0celot10": 2.4750473187541127e+22, // Artifact 2 fix (damage tracker)
    "0celot11": 5.9903240516481744e+23, // Artifact 2 fix (damage tracker)
    "0celot12": 5.170718958078967e+22, // Artifact 2 fix (damage tracker)
    "0celot13": 7.0869822286805265e+22, // Artifact 2 fix (damage tracker)
    "0celot14": 2.826849948177642e+22, // Artifact 2 fix (damage tracker)
    "0celot15": 1.2478162735534385e+25, // Artifact 2 fix (damage tracker)
    "0celot16": 5.777733003892782e+22, // Artifact 2 fix (damage tracker)
    "0celot17": 3.2401717331336416e+22, // Artifact 2 fix (damage tracker)
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
