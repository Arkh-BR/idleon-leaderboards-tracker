// CI smoke test — no private save. Every Multikill source must resolve on an
// empty envelope (the multikill switch throws on unknown ids), and the map
// rules must work on synthetic saves. Synthetic OLA arrays are sparse on
// purpose: a 0 at OLA[606] would switch companion 0 on (Pet-Bonus Token CSV).
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { MK_NODES, MK_POOLS, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { FORMULA_REGISTRY } from "@/scripts/updater/registry/formula-registry.gen";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const EMPTY = { charNames: ["A"], data: { StarSg: {} } };

describe("Multikill smoke test", () => {
  it("resolves every source on an empty save: 4 children, 9 and 18 sources, total 0", () => {
    const { tree, total } = computeArkhMultikill(EMPTY, 0, 14);
    expect(total).toBe(0);
    expect(tree.fmt).toBe("%");
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0].children).toHaveLength(MK_POOLS.base.length);
    expect(tree.children![2].children).toHaveLength(MK_POOLS.perTier.length);
  });

  it("a W7 map adds the soft-cap row to both halves and names the tier by its ×5 ladder", () => {
    const t = computeArkhMultikill(EMPTY, 0, 301).tree;
    expect(t.children![0].children!.at(-1)!.name).toBe(MK_RULES.softCap);
    expect(t.children![2].children!.at(-1)!.name).toBe(MK_RULES.softCap);
    expect(t.children![1].name).toBe(MK_NODES.tierW7);
    expect(t.children![1].children!.find((c) => c.name === "Exponent")!.val).toBe(5);
  });

  it("Clamworks (map 306) measures against Clamz_HP = 1e16·30^OLA[464]", () => {
    const ola: number[] = [];
    ola[464] = 8;
    const t = computeArkhMultikill({ charNames: ["A"], data: { StarSg: {}, OptLacc: ola } }, 0, 306).tree;
    expect(t.children![1].children!.find((c) => c.name === "Target HP")!.val).toBe(1e16 * Math.pow(30, 8));
  });

  it("the Crystal Glunko Cove (map 216, cavern 17) replaces both sums", () => {
    const ola: number[] = [];
    ola[645] = 38; // Cglunko_upgBon(15) = OLA[645]·RandoListo2[13][15] (100)
    ola[636] = 46; // Cglunko_upgBon(6)  = OLA[636]·RandoListo2[13][6]  (1)
    const cove = (cavern: number) => ({ charNames: ["A"], data: { StarSg: {}, OptLacc: ola, Holes: [[cavern]], CurrentMap_0: 216 } });
    const t = computeArkhMultikill(cove(17), 0, 216).tree;
    expect(t.children![0]).toMatchObject({ val: 3800 });
    expect(t.children![2]).toMatchObject({ val: 46 });
    expect(t.children![0].children!.at(-1)!.name).toBe(MK_RULES.cove);
    expect(t.val).toBe(Math.floor(3800 + Number(t.children![1].val) * 46));
    // Another cavern: the plain sums (0 on this save) and no rule row.
    const off = computeArkhMultikill(cove(3), 0, 216).tree;
    expect(off.val).toBe(0);
    expect(off.children![0].children).toHaveLength(MK_POOLS.base.length);
  });

  it("registers the port under N.js's names for the updater", () => {
    expect(FORMULA_REGISTRY["MultiKillTOTAL"]).toEqual(["lib/arkh/stats/defs/multikill.ts"]);
    expect(FORMULA_REGISTRY["MultiKill_perTier"]).toEqual([
      "lib/arkh/stats/defs/multikill.ts",
      "lib/arkh/stats/systems/multikill/multikill.ts",
    ]);
  });
});

describe("Multikill on the cached saves", () => {
  // Keep last: it loads real saves into the arkh singleton.
  const CACHE = "scripts/updater/golden/.cache";
  const cached = existsSync(CACHE) ? readdirSync(CACHE).filter((f) => f.endsWith(".json")) : [];
  it.skipIf(cached.length === 0)("every character gives a finite total on maps 14, 251 and 301", () => {
    for (const f of cached) {
      const save = JSON.parse(readFileSync(`${CACHE}/${f}`, "utf8"));
      for (let c = 0; c < (save.charNames?.length ?? 0); c++) {
        for (const m of [14, 251, 301]) {
          expect(Number.isFinite(computeArkhMultikill(save, c, m).total), `${f} #${c} map ${m}`).toBe(true);
        }
      }
    }
  }, 120_000);
});
