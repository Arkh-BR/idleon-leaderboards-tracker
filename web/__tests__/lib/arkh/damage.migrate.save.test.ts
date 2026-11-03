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
    ARKHE: 2.9990701027866615e+34, // Artifact 25 fix (damage tracker)
    ARKHELUCK: 2.5785185663809045e+34, // Artifact 25 fix (damage tracker)
    zArkhe: 4.0364840174893213e+34, // Artifact 25 fix (damage tracker)
    farkhe: 5.371489322808224e+38, // Artifact 25 fix (damage tracker)
    Darkhe: 2.5080874296515073e+34, // Artifact 25 fix (damage tracker)
    Parkhe: 2.8215736214072333e+34, // Artifact 25 fix (damage tracker)
    Warkhe: 1.4787750804162885e+38, // Artifact 25 fix (damage tracker)
    Sarkhe: 2.4578203506655697e+34, // Artifact 25 fix (damage tracker)
    Markhe: 5.641629271585107e+38, // Artifact 25 fix (damage tracker)
    Barkhe: 2.5247720974687113e+34, // Artifact 25 fix (damage tracker)
    Arkhiiiiii: 2.3558047151722284e+34, // Artifact 25 fix (damage tracker)
  },
  "Arlong.json": {
    Arlong: 7.542521204209215e+32, // Artifact 25 fix (damage tracker)
    arlongarcher: 5.740816842763545e+32, // Artifact 25 fix (damage tracker)
    richardburnish: 7.846341173716568e+32, // Artifact 25 fix (damage tracker)
    forsenmods: 2.9362292476182537e+35, // Artifact 25 fix (damage tracker)
    borushiki: 1.0801335062472249e+35, // Artifact 25 fix (damage tracker)
    ArlongHunter: 9.731118496385394e+34, // Artifact 25 fix (damage tracker)
    MyWifeLeftMe: 4.545353734952123e+34, // Artifact 25 fix (damage tracker)
    ALTAddiciton: 1.0289589749007854e+35, // Artifact 25 fix (damage tracker)
    Arshort: 8.406766322633863e+32, // Artifact 25 fix (damage tracker)
    Valtan: 6.733568851633823e+32, // Artifact 25 fix (damage tracker)
    Synergism: 5.978014323002411e+31, // Artifact 25 fix (damage tracker)
  },
  "24632463.json": {
    "24632463": 1.4828237175122894e+32, // Artifact 25 fix (damage tracker)
    "246324633": 1.755942429510752e+30, // Artifact 25 fix (damage tracker)
    "2463a": 5.885055043831627e+31, // Artifact 25 fix (damage tracker)
    "2463w": 6.782560889118114e+31, // Artifact 25 fix (damage tracker)
    "2463m": 1.2415172953671607e+31, // Artifact 25 fix (damage tracker)
    "2463a2": 1.0573905182164219e+32, // Artifact 25 fix (damage tracker)
    "2463w2": 8.806409233028538e+31, // Artifact 25 fix (damage tracker)
    "2463a3": 2.434335446564243e+30, // Artifact 25 fix (damage tracker)
    "2463m2": 2.9467357153819265e+30, // Artifact 25 fix (damage tracker)
    "2463b": 6.170946875834127e+29, // Artifact 25 fix (damage tracker)
    "2463w3": 1.0312314839410354e+30, // Artifact 25 fix (damage tracker)
  },
  "0celot8.json": {
    "0celot8": 4.5412739973928984e+23, // Artifact 25 fix (damage tracker)
    "0celot9": 6.844975742880897e+23, // Artifact 25 fix (damage tracker)
    "0celot10": 2.2639445853481374e+22, // Artifact 25 fix (damage tracker)
    "0celot11": 5.6387550619490855e+23, // Artifact 25 fix (damage tracker)
    "0celot12": 4.920830190510417e+22, // Artifact 25 fix (damage tracker)
    "0celot13": 6.424719227177683e+22, // Artifact 25 fix (damage tracker)
    "0celot14": 2.4615215337680233e+22, // Artifact 25 fix (damage tracker)
    "0celot15": 1.2083160384681397e+25, // Artifact 25 fix (damage tracker)
    "0celot16": 5.521814471037676e+22, // Artifact 25 fix (damage tracker)
    "0celot17": 2.936299283809413e+22, // Artifact 25 fix (damage tracker)
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
