import { describe, it, expect } from "vitest";
import { deriveGatedTalentsFor } from "@/scripts/_shared/classGating";
import { profileFlat } from "@/scripts/_shared/topStatCollector";
import { MK_CLASS_TALENTS } from "@/lib/arkh/stats/systems/multikill/multikill";
import { MK_NODES, MK_ROOT, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { combineMultikillPools } from "@/lib/arkh/computeMultikill";
import { topMultikillFlatForClass } from "@/lib/multikill/topMultikill";
import { TOP_MULTIKILL_PLAYERS_SCANNED } from "@/lib/multikill/topMultikill.meta";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const P = (...items: Array<[string, number]>): Pool => ({ items: items.map(([name, val]) => ({ name, val })), sum: 0, product: 0 });
const T46 = `${MK_ROOT} / ${MK_NODES.perTier} / Void Radius (Talent 46)`;
const T469 = `${MK_ROOT} / ${MK_NODES.perTier} / Mana Is Life (Talent 469)`;

describe("Multikill Observed Max", () => {
  it("gates Void Radius and Mana Is Life, never Monolithialism or Master Of The System (spec M16)", () => {
    expect(deriveGatedTalentsFor(MK_CLASS_TALENTS).map((t) => t.id).sort((a, b) => a - b)).toEqual([46, 469]);
    expect(deriveGatedTalentsFor([654, 58])).toEqual([]);
  });

  it("profileFlat zeroes the two gated buffs in the per-tier sum (groups: [] → neutral 0)", () => {
    const best = {
      base: P(["Base source", 100]),
      perTier: P(["Void Radius (Talent 46)", 40], ["Mana Is Life (Talent 469)", 60], ["Per-tier source", 100]),
      tier: P([MK_NODES.tier, 51]),
      rules: P([MK_RULES.softCap, 0], [MK_RULES.cove, 0]),
      status: P([MK_NODES.active, 1]),
    };
    const flat = profileFlat({ root: MK_ROOT, groups: [], combine: combineMultikillPools }, best, [46, 469]);
    expect(flat[T46]).toBe(0);
    expect(flat[T469]).toBe(0);
    expect(flat[MK_ROOT]).toBe(100 + 51 * 100);
  });

  it("the generated reference sits on the W6 page at tier 51; a Royal Guardian never sees the gated buffs", () => {
    expect(TOP_MULTIKILL_PLAYERS_SCANNED).toBeGreaterThanOrEqual(20);
    const top = topMultikillFlatForClass(null);
    expect(top[MK_ROOT]).toBeGreaterThan(0);
    expect(top[`${MK_ROOT} / ${MK_NODES.tier}`]).toBe(51);
    expect(top[`${MK_ROOT} / ${MK_NODES.perTier} / Death Note (W6 page)`]).toBeGreaterThan(0);
    expect(topMultikillFlatForClass("Royal_Guardian")[T46]).toBe(0);
    expect(topMultikillFlatForClass("Royal_Guardian")[T469]).toBe(0);
  });
});
