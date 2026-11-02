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
const CAPTURED: Record<string, Record<string, number>> = {
  "arkhe-live-2026-11-01-postupdate.json": {
    ARKHE: 2.776419535394748e+34, ARKHELUCK: 2.422228098682789e+34, zArkhe: 3.754696188591826e+34,
    farkhe: 5.040782524775504e+38, Darkhe: 2.3583154261966807e+34, Parkhe: 2.651262637665543e+34,
    Warkhe: 1.432236129426755e+38, Sarkhe: 2.3313231682679836e+34, Markhe: 5.2510891969663806e+38,
    Barkhe: 2.3721606488107907e+34, Arkhiiiiii: 2.2347684160606395e+34,
  },
  "Arlong.json": {
    Arlong: 6.798488582592886e+32, arlongarcher: 5.263631515676537e+32, richardburnish: 7.178900087998835e+32,
    forsenmods: 2.6496845870764568e+35, borushiki: 9.924124623542713e+34, ArlongHunter: 8.93214150621075e+34,
    MyWifeLeftMe: 4.32183056403544e+34, ALTAddiciton: 9.298151277873974e+34, Arshort: 7.595176591908996e+32,
    Valtan: 6.202356070923848e+32, Synergism: 5.739885507007991e+31,
  },
  "24632463.json": {
    "24632463": 1.4644834326161384e+32, "246324633": 1.7345496584022864e+30, "2463a": 5.820709648571976e+31,
    "2463w": 6.697240400535572e+31, "2463m": 1.2273306985036627e+31, "2463a2": 1.0448886912055128e+32,
    "2463w2": 8.690995328185575e+31, "2463a3": 2.405081214475219e+30, "2463m2": 2.9087013163115893e+30,
    "2463b": 6.0818974319943904e+29, "2463w3": 1.0221949704073836e+30,
  },
  "0celot8.json": {
    "0celot8": 3.3667076786885886e+23, "0celot9": 5.361602508642358e+23, "0celot10": 1.7368345608515605e+22,
    "0celot11": 4.59232049973213e+23, "0celot12": 3.7463547564025463e+22, "0celot13": 5.002446080350056e+22,
    "0celot14": 2.0087020685605487e+22, "0celot15": 9.014531530460838e+24, "0celot16": 4.2894317992711675e+22,
    "0celot17": 2.2863513899357044e+22,
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
