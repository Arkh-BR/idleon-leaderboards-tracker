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
    ARKHE: 2.7766371498204002e+34, ARKHELUCK: 2.4222513205759753e+34, zArkhe: 3.7550439926603195e+34,
    farkhe: 5.040782524917704e+38, Darkhe: 2.3583384075001786e+34, Parkhe: 2.651280278920277e+34,
    Warkhe: 1.4322361295261329e+38, Sarkhe: 2.331341023348853e+34, Markhe: 5.251093758355909e+38,
    Barkhe: 2.372183969948847e+34, Arkhiiiiii: 2.2347855056051522e+34,
  },
  "Arlong.json": {
    Arlong: 6.799066624056253e+32, arlongarcher: 5.263691488173615e+32, richardburnish: 7.178946968297116e+32,
    forsenmods: 2.649692519712955e+35, borushiki: 9.924124708749461e+34, ArlongHunter: 8.932141607252716e+34,
    MyWifeLeftMe: 4.321830661400303e+34, ALTAddiciton: 9.29817543805819e+34, Arshort: 7.596052614891807e+32,
    Valtan: 6.20240228937387e+32, Synergism: 5.740898333268079e+31,
  },
  "24632463.json": {
    "24632463": 1.4644846609040638e+32, "246324633": 1.7345645050668315e+30, "2463a": 5.820710165416866e+31,
    "2463w": 6.697240988039444e+31, "2463m": 1.2273654977384314e+31, "2463a2": 1.044888783119697e+32,
    "2463w2": 8.690996092123729e+31, "2463a3": 2.405099563119169e+30, "2463m2": 2.908899305244725e+30,
    "2463b": 6.082064697924241e+29, "2463w3": 1.0222069031901713e+30,
  },
  "0celot8.json": {
    "0celot8": 3.366766700951028e+23, "0celot9": 5.364678419055121e+23, "0celot10": 1.7369734576950101e+22,
    "0celot11": 4.595941728644595e+23, "0celot12": 3.7467453442874063e+22, "0celot13": 5.0026108081495005e+22,
    "0celot14": 2.0087771716149095e+22, "0celot15": 9.016810459635187e+24, "0celot16": 4.289860959200893e+22,
    "0celot17": 2.2864936550467226e+22,
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
