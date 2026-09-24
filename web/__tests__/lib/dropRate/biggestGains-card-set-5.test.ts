import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { flattenTree, nodePath } from "@/lib/dropRate/treeFlatten";
import {
  computeBiggestGains,
  DENYLIST_PATHS,
  ADDITIVE_POOL_PATH,
  POST_PROCESSING_PATH,
} from "@/lib/dropRate/biggestGains";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// Markhe wears card set 5, "Damage / Drop / EXP Set Bonus" (+36 DR): the only
// catalog label containing the " / " that flat paths join node names with.
// Biggest Gains picks systems by path splitting, so a system whose own name
// held " / " would drop out. Card set 5 is safe because it sits one level
// down, inside 🃏 Cards; these tests pin that.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("DR Biggest Gains with card set 5 (a name containing ' / ')", () => {
  let text: string;
  let idx: number;
  let tree: ArkhNode;
  beforeAll(() => {
    text = readFileSync(SAVE, "utf8").replace(/^﻿/, "");
    const save = JSON.parse(text);
    idx = save.charNames.indexOf("Markhe");
    tree = computeArkhDropRate(save, idx, 0).tree;
  });

  it("ranks the gap card set 5 opens under the additive 🃏 Cards system", () => {
    // Same save with the set taken off, measured against the one that wears it.
    const bare = JSON.parse(text);
    bare.data[`CSetEq_${idx}`] = "{}";
    const without = flattenTree(computeArkhDropRate(bare, idx, 0).tree);
    const { rows } = computeBiggestGains(without, flattenTree(tree));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      path: "Drop Rate / Additive Pool / 🃏 Cards",
      type: "additive",
    });
    expect(rows[0].max - rows[0].you).toBeCloseTo(36, 9);
  });

  it("weighs every system under the two pools except the denylisted ones", () => {
    // Systems read off the tree itself, not off split paths.
    const root = nodePath("", tree, [tree], 0);
    const systems: string[] = [];
    tree.children!.forEach((pool, i) => {
      const poolPath = nodePath(root, pool, tree.children!, i);
      if (poolPath !== ADDITIVE_POOL_PATH && poolPath !== POST_PROCESSING_PATH) return;
      pool.children!.forEach((s, j) => systems.push(nodePath(poolPath, s, pool.children!, j)));
    });
    const flat = flattenTree(tree);
    expect(computeBiggestGains(flat, flat).comparableSystems).toBe(
      systems.filter((p) => !DENYLIST_PATHS.has(p)).length
    );
  });
});
