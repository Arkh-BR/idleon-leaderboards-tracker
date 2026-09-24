import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { MK_NODES, MK_POOLS } from "@/lib/arkh/stats/defs/multikill";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getMultiKillBase / getMultiKillPerTier
// on this exact file (SP/mk/it-mk.mts), term by term via SP/mk/arkh-mk.mts,
// unless a comment says N.js ≠ IT (spec M8).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

const close = (actual: number, expected: number) => {
  if (expected === 0) expect(actual).toBe(0);
  else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
};

/** A source's value by pool position (root children: base, tier, per tier, status). */
const srcIn = (tree: ArkhNode, id: string): number => {
  const kids = tree.children!;
  if (MK_POOLS.base.includes(id)) return Number(kids[0].children![MK_POOLS.base.indexOf(id)].val);
  if (MK_POOLS.perTier.includes(id)) return Number(kids[2].children![MK_POOLS.perTier.indexOf(id)].val);
  if (id === "tier") return Number(kids[1].val);
  if (id === "active") return Number(kids[3].val);
  throw new Error(`not a source: ${id}`);
};

describe.skipIf(!existsSync(SAVE))("Multikill — Markhe on map 14 vs IdleonToolbox", () => {
  let save: any;
  let tree: ArkhNode;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    tree = computeArkhMultikill(save, save.charNames.indexOf("Markhe"), 14).tree;
  });
  const src = (id: string) => srcIn(tree, id);

  it("has the four root children; the tier's note names the map and target", () => {
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0].children).toHaveLength(MK_POOLS.base.length); // no rule row on map 14
    expect(tree.children![1].note).toBe("Map 14 · beanG"); // tier 51: no "estimate" (M17)
  });

  it.each<[string, number]>([
    // Base Multikill
    ["stampC19", 166], // StampC19 is the only "Overkill" stamp
    ["deathNoteBuilding", 102], // TowerInfo[2] = 51, ×2
    ["etc29", 30.450000000000003],
    ["ach148", 1],
    ["ach122", 6],
    ["ach123", 2],
    ["talent654", 576], // MONOLITHIALISM × onyx statues
    // Multikill per Tier
    ["vialOverkill", 101.92],
    ["talent58", 265.7718120805369], // account-wide × ⌊OLA[158]/5⌋
    ["arcade8", 20.09950248756219],
    ["artifact26", 150], // Trilobite Rock
    ["chipMkill", 0], // no Wood Chip in slots [9,20,21,15,16,17,18]
    ["etc71", 195.16191214168592],
    ["card80", 0],
    ["prayer16", 0], // Balance of Pain isn't equipped (12,1,3,5,14)
    ["shiny4", 80],
    ["box13b", 9.782608695652174],
    // No Multikill card set equipped. IT keys this set as "CardSet9", N.js as
    // "{%_Multikill_Per_Tier" — probably the same, unconfirmed (spec risk 4).
    ["cardSet11", 0],
    // Tier and status
    ["tier", 51],
    ["active", 1],
  ])("%s", (id, expected) => close(src(id), expected));
});
