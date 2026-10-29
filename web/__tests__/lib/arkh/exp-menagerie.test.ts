// Synthetic saves for the 2026-10-16 EXP terms: Pet Arena Crucible 15 and
// Menagerie Boost 23 (N.js ExpMulti(0)'s companion product), and the Classy
// Discoveries factor that lost its OLA[464] term.
import { describe, it, expect } from "vitest";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";
import { RANDOlist, Research } from "@/lib/arkh/stats/data/game/customlists.js";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const REQS = ((RANDOlist as any[])[115] as string[]).map(Number);
const PER_LV_23 = Number((Research as any[])[58][23]);

function src(data: Record<string, unknown>, id: string): number {
  const { tree } = computeArkhExpMulti({ charNames: ["A"], data }, 0, 14);
  const gi = EXP_GROUPS.findIndex((x) => x.sources.includes(id));
  return Number(tree.children![gi].children![EXP_GROUPS[gi].sources.indexOf(id)].val);
}

function menagerie(unlock8: number, boost23: number): unknown[] {
  const unlocks = Array(50).fill(0);
  unlocks[8] = unlock8;
  const boosts = Array(50).fill(0);
  boosts[23] = boost23;
  return [Array(20).fill(0), Array(50).fill(0), unlocks, boosts, [], [], [], []];
}

function ola(wave: number, clamClass = 0): number[] {
  const o: number[] = [];
  o[628] = wave;
  o[464] = clamClass;
  return o;
}

describe("EXP Multi — 2026-10-16 terms", () => {
  it("Crucible 15 gives ×1.2 only with all 16 waves and Menagerie Unlock 8", () => {
    expect(REQS).toHaveLength(16);
    const top = REQS[15];
    expect(src({ OptLacc: ola(top), Menagerie: menagerie(1, 0) }, "arenaCruc15")).toBeCloseTo(1.2, 12);
    expect(src({ OptLacc: ola(top - 1), Menagerie: menagerie(1, 0) }, "arenaCruc15")).toBe(1);
    expect(src({ OptLacc: ola(top), Menagerie: menagerie(0, 0) }, "arenaCruc15")).toBe(1);
  });

  it("Menagerie Boost 23 is ×(1 + Research[58][23]·lv/100)", () => {
    expect(src({ Menagerie: menagerie(0, 4) }, "menagerie23")).toBeCloseTo(1 + (PER_LV_23 * 4) / 100, 12);
    expect(src({}, "menagerie23")).toBe(1);
  });

  it("Classy Discoveries no longer reads the Clamworks class (OLA[464])", () => {
    // Super Bit 24 (N2L[24] = "x") owned, 30 discoveries → 1.03^30.
    const base = { Gaming: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "x"], Spelunk: [[], [], [], [], [], [], Array(30).fill(0)] };
    expect(src({ ...base, OptLacc: ola(0, 12) }, "classy")).toBeCloseTo(Math.pow(1.03, 30), 12);
    expect(src({ ...base, OptLacc: ola(0, 0) }, "classy")).toBeCloseTo(Math.pow(1.03, 30), 12);
  });
});
