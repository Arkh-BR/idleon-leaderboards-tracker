import { describe, it, expect } from "vitest";
import { formulaEval, getLOG } from "@/lib/corgan/formulas";

describe("formulaEval", () => {
  // add ================================================================
  describe("add", () => {
    it("computes add with non-zero x2", () => {
      // x1=10, x2=2, lv=1
      const x1 = 10;
      const x2 = 2;
      const lv = 1;
      const expected =
        ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1;
      expect(formulaEval("add", x1, x2, lv)).toBeCloseTo(expected, 10);
    });

    it("computes add when x2 is zero", () => {
      // Falls back to x1 * lv
      expect(formulaEval("add", 10, 0, 5)).toBe(50);
    });

    it("computes add for multiple levels", () => {
      const x1 = 5;
      const x2 = 1;
      const lv = 3;
      const expected =
        ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1;
      expect(formulaEval("add", x1, x2, lv)).toBeCloseTo(expected, 10);
    });
  });

  // addLower ============================================================
  it("addLower", () => {
    expect(formulaEval("addLower", 10, 5, 2)).toBe(10 + 5 * 3);
    expect(formulaEval("addLower", 0, 0, 0)).toBe(0);
  });

  // addDECAY ============================================================
  it("addDECAY below threshold", () => {
    expect(formulaEval("addDECAY", 10, 0, 100)).toBe(10 * 100);
  });

  it("addDECAY at exact threshold (lv<50001) still uses x1*lv", () => {
    expect(formulaEval("addDECAY", 10, 0, 50000)).toBe(10 * 50000);
  });

  it("addDECAY above threshold uses decay", () => {
    const lv = 55000;
    const x1 = 20;
    const expected =
      x1 * Math.min(50000, lv) +
      ((lv - 50000) / (lv - 50000 + 150000)) * x1 * 50000;
    expect(formulaEval("addDECAY", x1, 0, lv)).toBeCloseTo(expected, 10);
  });

  // decay ================================================================
  describe("decay", () => {
    it("computes decay formula", () => {
      expect(formulaEval("decay", 100, 50, 10)).toBeCloseTo(
        (100 * 10) / (10 + 50),
        10
      );
    });

    it("returns 0 when lv is 0", () => {
      expect(formulaEval("decay", 100, 50, 0)).toBe(0);
    });
  });

  // decayLower ============================================================
  it("decayLower is the incremental step", () => {
    const x1 = 100;
    const x2 = 50;
    const lv = 5;
    const expected =
      (x1 * (lv + 1)) / (lv + 1 + x2) - (x1 * lv) / (lv + x2);
    expect(formulaEval("decayLower", x1, x2, lv)).toBeCloseTo(expected, 10);
  });

  // decayMulti ============================================================
  it("decayMulti returns 1 + decay", () => {
    const x1 = 50;
    const x2 = 25;
    const lv = 5;
    const expected = 1 + (x1 * lv) / (lv + x2);
    expect(formulaEval("decayMulti", x1, x2, lv)).toBeCloseTo(expected, 10);
  });

  // decayMultiLower ======================================================
  it("decayMultiLower equals decayLower", () => {
    const x1 = 50;
    const x2 = 25;
    const lv = 5;
    const expected =
      (x1 * (lv + 1)) / (lv + 1 + x2) - (x1 * lv) / (lv + x2);
    expect(formulaEval("decayMultiLower", x1, x2, lv)).toBeCloseTo(expected, 10);
  });

  // bigBase ==============================================================
  it("bigBase", () => {
    expect(formulaEval("bigBase", 5, 3, 4)).toBe(5 + 3 * 4); // 17
  });

  // bigBaseLower =========================================================
  it("bigBaseLower returns x2 only", () => {
    expect(formulaEval("bigBaseLower", 99, 7, 5)).toBe(7);
  });

  // intervalAdd ===========================================================
  it("intervalAdd", () => {
    expect(formulaEval("intervalAdd", 10, 5, 12)).toBe(10 + Math.floor(12 / 5)); // 12
    expect(formulaEval("intervalAdd", 10, 5, 4)).toBe(10 + 0); // 10
  });

  // intervalAddLower =====================================================
  it("intervalAddLower", () => {
    const lv = 12;
    const x2 = 5;
    const expected =
      Math.max(Math.floor((lv + 1) / x2), 0) -
      Math.max(Math.floor(lv / x2), 0);
    expect(formulaEval("intervalAddLower", 0, x2, lv)).toBe(expected);
  });

  // reduce ================================================================
  it("reduce", () => {
    expect(formulaEval("reduce", 100, 5, 3)).toBe(100 - 5 * 3); // 85
  });

  // reduceLower ==========================================================
  it("reduceLower", () => {
    expect(formulaEval("reduceLower", 100, 5, 3)).toBe(100 - 5 * 4); // 80
  });

  // PtsSpentOnGuildBonus =================================================
  it("PtsSpentOnGuildBonus", () => {
    const x1 = 10;
    const x2 = 2;
    const lv = 3;
    const expected =
      ((x1 + x2) / x2 + 0.5 * (lv - 1)) / (x1 / x2) * lv * x1 - x2 * lv;
    expect(formulaEval("PtsSpentOnGuildBonus", x1, x2, lv)).toBeCloseTo(
      expected,
      10
    );
  });

  // unknown type =========================================================
  it("returns 0 for unknown formula type", () => {
    expect(formulaEval("nonexistent", 1, 2, 3)).toBe(0);
  });
});

describe("getLOG", () => {
  it("computes log10-like helper", () => {
    // getLOG(100) == Math.log(100)/2.30259 ~= 2.0 / 2.30259 * 2.30259 ? 
    // Actually: Math.log(100) / 2.30259 == (4.60517 / 2.30259) ≈ 2.0
    expect(getLOG(100)).toBeCloseTo(2.0, 2);
  });

  it("returns 0 for x=1", () => {
    expect(getLOG(1)).toBeCloseTo(0, 10);
  });

  it("clamps at 1 for x < 1", () => {
    expect(getLOG(0)).toBeCloseTo(0, 10);
    expect(getLOG(0.5)).toBeCloseTo(Math.log(1) / 2.30259, 10);
  });
});
