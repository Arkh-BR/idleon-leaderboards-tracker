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

// Regression pin of the Task 3 values: max damage with every term that
// already had a port elsewhere wired in (Flurbo, vault kills, Roo, Bubba, land
// rank, divinity minor, Rift skills, compass, MSA, crop depot, pet arena, salt
// lick, owl, spelunk shop, Cglunko, fountain, base-damage food, Cactolyte,
// Reliquarium). Captured 2026-11-02 with computeMaxDamage(ci, { saveData,
// charIdx: ci }) (no map: map 43/306 neutral), per character. The Task 2 pin
// (the old derived-damage number) is in git history; per-save before → after
// is in the Task 3 commit body. Saves (gitignored golden cache): ARKHE
// post-update, then by account level (Σ character levels) the strongest
// (Arlong 20922), a middle one (24632463 18198) and the weakest (0celot8 9753).
const DIR = "scripts/updater/golden/.cache/";
const CAPTURED: Record<string, Record<string, number>> = {
  "arkhe-live-2026-11-01-postupdate.json": {
    ARKHE: 2.2745392623905634e+33, ARKHELUCK: 1.984373342242861e+33, zArkhe: 3.075977456010111e+33,
    farkhe: 4.129584027056621e+37, Darkhe: 1.9320138623153094e+33, Parkhe: 2.1720063871478434e+33,
    Warkhe: 1.173337555029224e+37, Sarkhe: 1.909900867626751e+33, Markhe: 4.3018745533775425e+37,
    Barkhe: 1.9433563492957047e+33, Arkhiiiiii: 1.8307998628736013e+33,
  },
  "Arlong.json": {
    Arlong: 5.585721047359333e+31, arlongarcher: 4.324663781584962e+31, richardburnish: 5.898271774861364e+31,
    forsenmods: 2.177013138595555e+34, borushiki: 8.153781699107847e+33, ArlongHunter: 7.338756284298223e+33,
    MyWifeLeftMe: 3.5508686454904095e+33, ALTAddiciton: 7.639474371896854e+33, Arshort: 6.2402896220878285e+31,
    Valtan: 5.095931312921777e+31, Synergism: 4.715959863199386e+30,
  },
  "24632463.json": {
    "24632463": 2.2949411760219873e+31, "246324633": 2.7181525883233874e+29, "2463a": 9.121432136868468e+30,
    "2463w": 1.0495013066450707e+31, "2463m": 1.9233073545668176e+30, "2463a2": 1.6374088148771775e+31,
    "2463w2": 1.36193572389123e+31, "2463a3": 3.768919325305133e+29, "2463m2": 4.558124913457115e+29,
    "2463b": 7.864243435828153e+28, "2463w3": 1.6018462723882404e+29,
  },
  "0celot8.json": {
    "0celot8": 1.0004181355250402e+23, "0celot9": 2.247677508764839e+23, "0celot10": 5.161008863615786e+21,
    "0celot11": 1.6274404777365148e+23, "0celot12": 1.1132303769831054e+22, "0celot13": 1.4864782628597153e+22,
    "0celot14": 4.1398116080989336e+21, "0celot15": 3.1845122521779566e+24, "0celot16": 1.2746058759634273e+22,
    "0celot17": 6.793899617871238e+21,
  },
};

const close = (actual: number, expected: number) => expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);

/** Every node whose val is NaN (flattenTree would read it as 0 and hide it). */
const nanPaths = (n: ArkhNode, path = n.name): string[] => [
  ...(Number.isNaN(n.val) ? [path] : []),
  ...(n.children ?? []).flatMap((k) => nanPaths(k, `${path} / ${k.name}`)),
];

for (const [file, want] of Object.entries(CAPTURED)) {
  describe.skipIf(!existsSync(DIR + file))(`max damage, Task 3 value — ${file}`, () => {
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
