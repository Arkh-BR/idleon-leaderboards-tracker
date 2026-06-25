import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  computeBiggestGains,
  splitByThreshold,
  MINOR_GAIN_THRESHOLD_PCT,
  DENYLIST_PATHS,
  ADDITIVE_POOL_PATH,
  POST_PROCESSING_PATH,
} from "@/lib/dropRate/biggestGains";

// ---- helpers ----------------------------------------------------------------

const A = (sys: string) => `${ADDITIVE_POOL_PATH} / ${sys}`;
const P = (sys: string) => `${POST_PROCESSING_PATH} / ${sys}`;

/** Build a minimal flat tree with an additive pool node + named systems. */
function additiveFlat(poolSum: number, systems: Record<string, number>) {
  const out: Record<string, number> = { [ADDITIVE_POOL_PATH]: poolSum };
  for (const [sys, v] of Object.entries(systems)) out[A(sys)] = v;
  return out;
}
function postFlat(systems: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [sys, v] of Object.entries(systems)) out[P(sys)] = v;
  return out;
}

// ---- multiplier correctness -------------------------------------------------

describe("computeBiggestGains — multiplier levers", () => {
  it("gain = (ref/yours − 1) × 100", () => {
    const yours = postFlat({ "🎽 Equipment": 2 });
    const ref = postFlat({ "🎽 Equipment": 3 });
    const { rows } = computeBiggestGains(yours, ref);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("multiplier");
    expect(rows[0].system).toBe("🎽 Equipment");
    expect(rows[0].drGainPct).toBeCloseTo(50, 6); // (3/2 − 1)×100
  });

  it("scaling the engine total by ref/yours matches the reported gain (±1%)", () => {
    // A multiplier lever improving yours→ref multiplies the whole total by
    // ref/yours, so newTotal/oldTotal − 1 must equal drGainPct/100.
    const yours = postFlat({ "🖼️ Gallery": 4 });
    const ref = postFlat({ "🖼️ Gallery": 5 });
    const oldTotal = 1000;
    const { rows } = computeBiggestGains(yours, ref);
    const newTotal = oldTotal * (5 / 4);
    const impliedPct = (newTotal / oldTotal - 1) * 100;
    expect(rows[0].drGainPct).toBeCloseTo(impliedPct, 6);
  });
});

// ---- additive correctness ---------------------------------------------------

describe("computeBiggestGains — additive levers", () => {
  it("two additive systems with the same pp gap produce the same DR gain", () => {
    const yours = additiveFlat(100, { "🅰️ SysA": 50, "🅱️ SysB": 50 });
    const ref = additiveFlat(100, { "🅰️ SysA": 150, "🅱️ SysB": 150 }); // gap 100 each
    const { rows, totalSum } = computeBiggestGains(yours, ref);
    expect(totalSum).toBeCloseTo(2, 6); // 1 + 100/100
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe("additive");
    // gain = (gap/100)/TotalSum × 100 = (100/100)/2 × 100 = 50
    expect(rows[0].drGainPct).toBeCloseTo(50, 6);
    expect(rows[1].drGainPct).toBeCloseTo(50, 6);
  });

  it("additive gain uses the player's additive pool as TotalSum denominator", () => {
    // poolSum 400 → TotalSum 5; gap 200 → (200/100)/5×100 = 40
    const yours = additiveFlat(400, { "🍔 Golden Food": 100 });
    const ref = additiveFlat(400, { "🍔 Golden Food": 300 });
    const { rows } = computeBiggestGains(yours, ref);
    expect(rows[0].drGainPct).toBeCloseTo(40, 6);
  });
});

// ---- ordering ---------------------------------------------------------------

describe("computeBiggestGains — ordering", () => {
  it("rows are sorted by DR gain descending", () => {
    const yours = postFlat({ "🃏 Cards": 1, "🎽 Equipment": 1, "🖼️ Gallery": 1 });
    const ref = postFlat({ "🃏 Cards": 1.2, "🎽 Equipment": 1.5, "🖼️ Gallery": 2 });
    const { rows } = computeBiggestGains(yours, ref);
    const gains = rows.map((r) => r.drGainPct);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
    expect(rows[0].system).toBe("🖼️ Gallery"); // +100%
  });
});

// ---- denylist & safety net --------------------------------------------------

describe("computeBiggestGains — denylist", () => {
  it("excludes the 🔹 Other catch-all and 🗺️ Arcane Map even with large gains", () => {
    const yours = postFlat({ "🔹 Other": 1, "🗺️ Arcane Map": 1, "🎽 Equipment": 2 });
    const ref = postFlat({ "🔹 Other": 9, "🗺️ Arcane Map": 2, "🎽 Equipment": 3 });
    const { rows } = computeBiggestGains(yours, ref);
    const systems = rows.map((r) => r.system);
    expect(systems).not.toContain("🔹 Other");
    expect(systems).not.toContain("🗺️ Arcane Map");
    expect(systems).toEqual(["🎽 Equipment"]);
  });

  it("DENYLIST_PATHS contains the two excluded full paths", () => {
    expect(DENYLIST_PATHS.has(P("🔹 Other"))).toBe(true);
    expect(DENYLIST_PATHS.has(P("🗺️ Arcane Map"))).toBe(true);
  });
});

describe("computeBiggestGains — non-finite safety net", () => {
  it("drops a multiplier with non-finite ratio (ref Infinity)", () => {
    const yours = postFlat({ "🔮 Inf": 1, "🎽 Equipment": 2 });
    const ref = postFlat({ "🔮 Inf": Infinity, "🎽 Equipment": 3 });
    const { rows } = computeBiggestGains(yours, ref);
    expect(rows.map((r) => r.system)).toEqual(["🎽 Equipment"]);
    expect(rows.every((r) => Number.isFinite(r.drGainPct))).toBe(true);
  });

  it("drops a multiplier with yours = 0 (division by zero)", () => {
    const yours = postFlat({ "🆕 New": 0, "🎽 Equipment": 2 });
    const ref = postFlat({ "🆕 New": 2, "🎽 Equipment": 3 });
    const { rows } = computeBiggestGains(yours, ref);
    expect(rows.map((r) => r.system)).toEqual(["🎽 Equipment"]);
  });

  it("skips systems missing from the reference (no comparable max)", () => {
    const yours = postFlat({ "🎽 Equipment": 2, "🆕 Unmatched": 2 });
    const ref = postFlat({ "🎽 Equipment": 3 });
    const { rows } = computeBiggestGains(yours, ref);
    expect(rows.map((r) => r.system)).toEqual(["🎽 Equipment"]);
  });
});

// ---- threshold --------------------------------------------------------------

describe("splitByThreshold", () => {
  it("MINOR_GAIN_THRESHOLD_PCT is 0.05", () => {
    expect(MINOR_GAIN_THRESHOLD_PCT).toBe(0.05);
  });

  it("separates major (≥ threshold) from minor (< threshold)", () => {
    const yours = postFlat({ "🎽 Equipment": 2, "📖 Tome": 1000 });
    const ref = postFlat({ "🎽 Equipment": 3, "📖 Tome": 1000.2 }); // tiny gain
    const { rows } = computeBiggestGains(yours, ref);
    const { major, minor } = splitByThreshold(rows);
    expect(major.map((r) => r.system)).toEqual(["🎽 Equipment"]);
    expect(minor.map((r) => r.system)).toEqual(["📖 Tome"]);
  });
});

// ---- comparable-systems metadata (drives the UI states) ---------------------

describe("computeBiggestGains — comparable systems / at-ceiling", () => {
  it("counts comparable systems but yields no rows when all gaps ≤ 0", () => {
    // Player is at or above ref on every system → at-ceiling state.
    const yours = postFlat({ "🎽 Equipment": 3, "🃏 Cards": 2 });
    const ref = postFlat({ "🎽 Equipment": 3, "🃏 Cards": 1.5 });
    const { rows, comparableSystems } = computeBiggestGains(yours, ref);
    expect(rows).toHaveLength(0);
    expect(comparableSystems).toBe(2);
  });

  it("reports zero comparable systems when nothing overlaps the reference", () => {
    const yours = postFlat({ "🎽 Equipment": 2 });
    const ref = postFlat({ "🃏 Cards": 3 });
    const { rows, comparableSystems } = computeBiggestGains(yours, ref);
    expect(rows).toHaveLength(0);
    expect(comparableSystems).toBe(0);
  });
});

// ---- anchor regression (real engine output) ---------------------------------

describe("computeBiggestGains — anchor regression (zArkhe, Divine Knight)", () => {
  const fixturePath = path.resolve(
    process.cwd(),
    "__tests__/fixtures/zarkhe-biggest-gains.json"
  );
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    yours: Record<string, number>;
    ref: Record<string, number>;
  };

  it("top-3 levers are Gallery (mult ~+37%), Cards (mult ~+23%), Golden Food (add ~+10%)", () => {
    const { rows } = computeBiggestGains(fixture.yours, fixture.ref);

    expect(rows[0].system).toBe("🖼️ Gallery");
    expect(rows[0].type).toBe("multiplier");
    expect(rows[0].drGainPct).toBeGreaterThan(36);
    expect(rows[0].drGainPct).toBeLessThan(38);

    expect(rows[1].system).toBe("🃏 Cards");
    expect(rows[1].type).toBe("multiplier");
    expect(rows[1].drGainPct).toBeGreaterThan(22);
    expect(rows[1].drGainPct).toBeLessThan(24);

    expect(rows[2].system).toBe("🍔 Golden Food");
    expect(rows[2].type).toBe("additive");
    expect(rows[2].drGainPct).toBeGreaterThan(9);
    expect(rows[2].drGainPct).toBeLessThan(11);
  });

  it("no denylisted, non-finite, or non-positive rows in the anchor ranking", () => {
    const { rows } = computeBiggestGains(fixture.yours, fixture.ref);
    for (const r of rows) {
      expect(DENYLIST_PATHS.has(r.path)).toBe(false);
      expect(r.system).not.toBe("🔹 Other");
      expect(r.system).not.toBe("🗺️ Arcane Map");
      expect(Number.isFinite(r.drGainPct)).toBe(true);
      expect(r.drGainPct).toBeGreaterThan(0);
    }
  });
});
