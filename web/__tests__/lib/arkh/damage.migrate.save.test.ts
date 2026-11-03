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
    "24632463": 1.4972436070187004e+32, // active-char chips fix (damage tracker)
    "246324633": 1.6734382957324247e+30, // active-char chips fix (damage tracker)
    "2463a": 5.91498394887791e+31, // active-char chips fix (damage tracker)
    "2463w": 6.810153834185378e+31, // active-char chips fix (damage tracker)
    "2463m": 1.148965245477348e+31, // active-char chips fix (damage tracker)
    "2463a2": 1.0620814920962943e+32, // active-char chips fix (damage tracker)
    "2463w2": 8.887358391975038e+31, // active-char chips fix (damage tracker)
    "2463a3": 2.357093316354946e+30, // active-char chips fix (damage tracker)
    "2463m2": 2.840698853116713e+30, // active-char chips fix (damage tracker)
    "2463b": 5.977244480724832e+29, // active-char chips fix (damage tracker)
    "2463w3": 9.881573630387946e+29, // active-char chips fix (damage tracker)
  },
  "0celot8.json": {
    "0celot8": 4.6939843048304246e+23, // active-char chips fix (damage tracker)
    "0celot9": 7.374967468640844e+23, // active-char chips fix (damage tracker)
    "0celot10": 2.4741284202583438e+22, // active-char chips fix (damage tracker)
    "0celot11": 5.9893231504349497e+23, // active-char chips fix (damage tracker)
    "0celot12": 5.168799250986699e+22, // active-char chips fix (damage tracker)
    "0celot13": 7.0869822286805265e+22, // Artifact 2 fix (damage tracker)
    "0celot14": 2.8258004377041604e+22, // active-char chips fix (damage tracker)
    "0celot15": 1.2476077805217265e+25, // active-char chips fix (damage tracker)
    "0celot16": 5.775587933718887e+22, // active-char chips fix (damage tracker)
    "0celot17": 3.2389687707003506e+22, // active-char chips fix (damage tracker)
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
