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

// Task 2 pin: moving max damage into the `damage` system's sources must not
// move the number. Captured 2026-11-02 BEFORE the migration with the old
// derived-damage computeMaxDamage(ci, { saveData, charIdx: ci }), per character.
// Saves (gitignored golden cache): ARKHE post-update, then by account level
// (Σ character levels) the strongest (Arlong 20922), a middle one (24632463
// 18198) and the weakest (0celot8 9753) of the other profiles.
const DIR = "scripts/updater/golden/.cache/";
const CAPTURED: Record<string, Record<string, number>> = {
  "arkhe-live-2026-11-01-postupdate.json": {
    ARKHE: 9.288189398250744e31, ARKHELUCK: 8.10102107902781e31, zArkhe: 1.2661117309610439e32,
    farkhe: 1.6871103268683907e36, Darkhe: 7.880237402481089e31, Parkhe: 8.858504853773767e31,
    Warkhe: 4.795406469486447e35, Sarkhe: 7.788496622452943e31, Markhe: 1.7728455274603424e36,
    Barkhe: 7.933485276768153e31, Arkhiiiiii: 7.466698674592547e31,
  },
  "Arlong.json": {
    Arlong: 2.916377794688388e30, arlongarcher: 2.25598457672424e30, richardburnish: 3.074160353209722e30,
    forsenmods: 1.1496961185030044e33, borushiki: 4.256324150549342e32, ArlongHunter: 3.830433010907364e32,
    MyWifeLeftMe: 1.852106072121142e32, ALTAddiciton: 3.9954020975566555e32, Arshort: 3.290216642639129e30,
    Valtan: 2.655954651967463e30, Synergism: 2.4483323372879376e29,
  },
  "24632463.json": {
    "24632463": 1.0738648636278915e30, "246324633": 1.2680630128488374e28, "2463a": 4.270500769182451e29,
    "2463w": 4.9078048309057155e29, "2463m": 9.304351459318759e28, "2463a2": 7.669593549367827e29,
    "2463w2": 6.370727762522309e29, "2463a3": 1.7624799702776884e28, "2463m2": 2.1296387476549395e28,
    "2463b": 3.5650090138144597e27, "2463w3": 7.454116120496367e27,
  },
  "0celot8.json": {
    "0celot8": 1.6576363542845989e21, "0celot9": 1.4271571787142872e22, "0celot10": 252706058292009300000,
    "0celot11": 3.0469041472982053e21, "0celot12": 661882975395097300000, "0celot13": 417461847914033250000,
    "0celot14": 30798594706033885000, "0celot15": 2.170835234962349e23, "0celot16": 760303099552219700000,
    "0celot17": 417806207945243600000,
  },
};

const close = (actual: number, expected: number) => expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);

/** Every node whose val is NaN (flattenTree would read it as 0 and hide it). */
const nanPaths = (n: ArkhNode, path = n.name): string[] => [
  ...(Number.isNaN(n.val) ? [path] : []),
  ...(n.children ?? []).flatMap((k) => nanPaths(k, `${path} / ${k.name}`)),
];

for (const [file, want] of Object.entries(CAPTURED)) {
  describe.skipIf(!existsSync(DIR + file))(`max damage as the damage system's sources — ${file}`, () => {
    // Read in beforeAll: vitest still runs a skipped describe's body.
    let save: any;
    beforeAll(() => {
      save = JSON.parse(readFileSync(DIR + file, "utf8").replace(/^﻿/, ""));
    });

    it.each(Object.entries(want))("%s: same Max as before, finite, tree without NaN", (name, old) => {
      const ci = save.charNames.indexOf(name);
      expect(ci).toBeGreaterThanOrEqual(0);
      loadSaveData(save);
      const max = computeMaxDamage(ci, { saveData, charIdx: ci });
      expect(Number.isFinite(max) && max > 0).toBe(true);
      close(max, old);

      const r = computeArkhDamage(save, ci, Number(currentMapData[ci]) || 0);
      expect(r.total).toBe(max);
      expect(nanPaths(r.tree)).toEqual([]);
    });
  });
}
