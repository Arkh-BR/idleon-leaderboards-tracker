import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { AFK_POOLS } from "@/lib/arkh/stats/defs/afk-gains";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getAfkGain breakdown on this exact
// file for Markhe on map 14 (SP/afk/it-afk.mts), unless a comment says
// N.js ≠ IT (spec A7: IT has three proven bugs).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

const close = (actual: number, expected: number) => {
  if (expected === 0) expect(actual).toBe(0);
  else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
};

/** A source's value, found by its pool position (G1 = fight then ALL). */
const srcIn = (tree: ArkhNode, id: string): number => {
  const [fight, all, multi, rules] = AFK_POOLS.map((p) => p.sources);
  const kids = tree.children!;
  if (fight.includes(id)) return Number(kids[0].children![fight.indexOf(id)].val);
  if (all.includes(id)) return Number(kids[0].children![fight.length + all.indexOf(id)].val);
  if (multi.includes(id)) return Number(kids[1 + multi.indexOf(id)].children![0].val);
  return Number(kids[3 + rules.indexOf(id)].val);
};

describe.skipIf(!existsSync(SAVE))("AFK Gains Rate — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  beforeAll(() => {
    const save = JSON.parse(readFileSync(SAVE, "utf8"));
    tree = computeArkhAfkGains(save, save.charNames.indexOf("Markhe"), 14).tree;
  });
  const src = (id: string) => srcIn(tree, id);

  it.each<[string, number]>([
    // fight pool
    ["base", 40],
    ["fam8", 4.369959677419355],
    ["boxFightAFK", 8.478260869565217],
    ["talent88", 18.616874135546336],
    ["bribe3", 5],
    ["talent268", 0],
    ["cardSet10", 0],
    ["talent448", 0],
    ["talent621", 6.340248962655601],
    ["card43", 0],
    ["talent79", 0],
    ["etc20", 62.58095607084296],
    // N.js ≠ IT: IT calls getStatsFromGear(ch, 59) without `account` → 699.2619263172074
    // (loses the Silkrode chip ×2 and Well-Dressed); N.js EtcBonuses("59") has them.
    ["etc59", 719.5619263172074],
    ["guild4", 5],
    ["cardW6d1", 7],
    // ALL pool
    ["merit", 2],
    ["arcade6", 8.039800995024876],
    ["compass57", 10.8],
    ["divMinor5", 268.9841724997589],
    ["comp6", 8],
    ["comp25", 50],
    ["shrine8", 6.075],
    ["talent650", 2.5],
    ["winBonus11", 212.93999999999997],
    // N.js ≠ IT: IT 5492.85043625293; arkh's golden-food multi is the one
    // validated to the cent on the DR (talent 209 getbonus2, PR #28).
    ["goldFoodAllAFK", 5500.8382581543565],
    ["cardW6d3", 10.5],
    ["vote6", 0], // vote 32 is the active one on this save
    ["eventShop5", 20],
    ["vault23", 59.1],
    ["bunU", 30],
    // MULTI and the map rules
    ["arcaneMapAfk", 0], // map 14 has no slot-2 kills
    ["etc92", 396.613269898924],
    ["clamworks306", 1],
    ["cglunkoCove", 0],
    ["afkType", 1], // beanG is FIGHTING
  ])("%s", (id, expected) => close(src(id), expected));
});
