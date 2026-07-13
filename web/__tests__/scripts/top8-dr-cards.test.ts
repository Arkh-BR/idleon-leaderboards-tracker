import { describe, it, expect } from "vitest";
import {
  selectTop8DrCards,
  obtainableDrCards,
  buildDrCardInputs,
  capDrCardsInPools,
  patchCardFlatDisplay,
  type DrCardIn,
} from "../../scripts/_shared/top8DrCards";
import { CARD_DR_BONUS, CARD_DR_MULTI } from "@/lib/arkh/stats/data/common/cards";

const M = (key: string, val: number): DrCardIn => ({ key, type: "multi", val });
const A = (key: string, val: number): DrCardIn => ({ key, type: "add", val });

describe("selectTop8DrCards (pre-valued)", () => {
  it("≥2 multi → boost slots (1 & 8) = the 2 largest multi, even vs bigger additive", () => {
    const r = selectTop8DrCards(
      [M("m1", 30), M("m2", 20), M("m3", 10)],
      [A("a1", 999)]
    );
    const boosted = r.picks.filter((p) => p.boosted);
    expect(boosted.map((p) => p.key).sort()).toEqual(["m1", "m2"]);
    expect(boosted.map((p) => p.slot).sort()).toEqual([1, 8]);
  });

  it("1 multi → slot 1 = multi, slot 8 = largest additive", () => {
    const r = selectTop8DrCards([M("m1", 50)], [A("a1", 100), A("a2", 80)]);
    expect(r.picks.find((p) => p.slot === 1)!.key).toBe("m1");
    const s8 = r.picks.find((p) => p.slot === 8)!;
    expect(s8.key).toBe("a1");
    expect(s8.boosted).toBe(true);
  });

  it("0 multi → boost slots = 2 largest additives", () => {
    const r = selectTop8DrCards([], [A("a1", 100), A("a2", 80), A("a3", 60)]);
    expect(r.picks.filter((p) => p.boosted).map((p) => p.key).sort()).toEqual([
      "a1",
      "a2",
    ]);
  });

  it("caps at 8", () => {
    const add = Array.from({ length: 20 }, (_, i) => A("a" + i, 20 - i));
    const r = selectTop8DrCards([M("m1", 5), M("m2", 4)], add);
    expect(r.picks).toHaveLength(8);
    expect(r.picks.filter((p) => p.boosted)).toHaveLength(2);
  });

  it("boost is linear ×2, not squared", () => {
    const r = selectTop8DrCards([M("m1", 10), M("m2", 10)], []);
    const p = r.picks.find((p) => p.slot === 1)!;
    expect(p.effVal).toBeCloseTo(p.val * 2, 9);
  });

  it("slots 2-7 take remaining multi before additive", () => {
    const r = selectTop8DrCards([M("m1", 5), M("m2", 4), M("m3", 3)], [A("a1", 999)]);
    expect(r.picks.find((p) => p.slot === 2)!.type).toBe("multi");
  });
});

describe("obtainableDrCards", () => {
  it("drops unreleased placeholders (w7b9/w7b10), keeps released", () => {
    const m = obtainableDrCards(CARD_DR_MULTI);
    expect(m.w7b9).toBeUndefined(); // Ancientfish (ExpGiven 1)
    expect(m.w7b10).toBeUndefined(); // Magni Pufferfin (ExpGiven 1)
    expect(m.w7a12).toBeDefined(); // Coralcave Guardian
    expect(m.w7b7).toBeDefined(); // Mantaray
  });

  it("keeps every additive DR card (all mobs released)", () => {
    expect(Object.keys(obtainableDrCards(CARD_DR_BONUS))).toHaveLength(
      Object.keys(CARD_DR_BONUS).length
    );
  });
});

describe("buildDrCardInputs (observed stars)", () => {
  const starLvOf = (k: string) =>
    ({ Crystal0: 7, w7a12: 5 }) as Record<string, number>;

  it("uses observed star level × base × 1.75, skips never-observed (lv 0)", () => {
    const { multi, add } = buildDrCardInputs((k) => starLvOf(k)[k] ?? 0);
    // only Crystal0 (add) and w7a12 (multi) were observed
    expect(add.map((c) => c.key)).toEqual(["Crystal0"]);
    expect(multi.map((c) => c.key)).toEqual(["w7a12"]);
    expect(add[0].val).toBeCloseTo(5 * 7 * 1.75, 9); // base 5 × lv 7 × legend
    expect(multi[0].val).toBeCloseTo(1 * 5 * 1.75, 9); // base 1 × lv 5 × legend
  });

  it("never emits an unreleased placeholder even if 'observed'", () => {
    const { multi } = buildDrCardInputs((k) => (k === "w7b9" ? 6 : 0));
    expect(multi).toHaveLength(0); // w7b9 filtered by obtainableDrCards
  });
});

describe("capDrCardsInPools + patchCardFlatDisplay (generator glue)", () => {
  const ADD_NODE =
    "Drop Rate / Additive Pool / 🃏 Cards / Drop Rate Cards (Card Type 10)";
  // 9 additive + 2 multi observed at star lv 7 (the naive node summed all 9)
  const mkFlat = (): Record<string, number> => {
    const f: Record<string, number> = {};
    for (const k of [
      "Boss6A", "w6d2", "w5a3", "babaMummy", "Crystal0",
      "speaker", "xmasEvent", "crabcakeB", "mimicA",
    ])
      f[`X (Card ${k}) / Star Lv`] = 7;
    for (const k of ["w7a12", "w7b7"]) f[`X (Card ${k}) / Star Lv`] = 7;
    f[ADD_NODE] = 741.125;
    f[ADD_NODE + " / Mimic (Card mimicA)"] = 24.5; // stale child to be removed
    f["Drop Rate / Additive Pool / 🃏 Cards"] = 1000;
    f["Drop Rate / Additive Pool"] = 5000;
    f["Drop Rate / Total Sum"] = 50;
    return f;
  };
  const mkPools = () =>
    ({
      addMain: {
        items: [{ name: "Drop Rate Cards (Card Type 10)", val: 741.125 }],
        sum: 0,
        product: 0,
      },
      postMult: {
        items: [{ name: "Drop Rate Multi Cards (Card Type 101)", val: 49 }],
        sum: 0,
        product: 0,
      },
    }) as any;

  it("caps pool items to the best-8 sums (fewer than the 9 observed)", () => {
    const grp = { bestFlat: mkFlat(), bestPools: mkPools() };
    const sel = capDrCardsInPools(grp);
    expect(sel.picks.length).toBeLessThanOrEqual(8);
    expect(grp.bestPools.addMain.items[0].val).toBeCloseTo(sel.additiveSum, 9);
    expect(grp.bestPools.postMult.items[0].val).toBeCloseTo(sel.multiSum, 9);
    expect(sel.additiveSum).toBeLessThan(741.125); // was 9 additives, now ≤6
    expect(sel.picks.filter((p) => p.boosted).every((p) => p.type === "multi")).toBe(true);
  });

  it("shows the FULL additive catalog: picks valued, rest +0; ancestors shift by delta", () => {
    const flat = mkFlat();
    const grp = { bestFlat: flat, bestPools: mkPools() };
    const beforePool = flat["Drop Rate / Additive Pool"];
    const sel = capDrCardsInPools(grp);
    patchCardFlatDisplay(flat, sel);
    const delta = sel.additiveSum - 741.125;
    expect(flat[ADD_NODE]).toBeCloseTo(sel.additiveSum, 9);
    // every obtainable additive card is listed (full catalog), not just picks
    const kids = Object.keys(flat).filter((p) => p.startsWith(ADD_NODE + " / "));
    expect(kids).toHaveLength(Object.keys(obtainableDrCards(CARD_DR_BONUS)).length);
    // a non-selected card (Mimic) shows with +0, no longer deleted
    expect(flat[ADD_NODE + " / Mimic (Card mimicA)"]).toBe(0);
    // a selected card carries its value
    expect(flat[ADD_NODE + " / Emperor (Card Boss6A)"]).toBeGreaterThan(0);
    expect(flat["Drop Rate / Additive Pool"]).toBeCloseTo(beforePool + delta, 6);
  });

  it("shows the full multi catalog too, valued only on the slotted multi", () => {
    const MULTI_NODE =
      "Drop Rate / Post-Processing / 🃏 Cards / Drop Rate Multi Cards (Card Type 101)";
    const flat = mkFlat();
    flat[MULTI_NODE] = 49;
    flat[MULTI_NODE + " / Coralcave Guardian (Card w7a12)"] = 24.5; // stale
    const grp = { bestFlat: flat, bestPools: mkPools() };
    const sel = capDrCardsInPools(grp);
    patchCardFlatDisplay(flat, sel);
    const kids = Object.keys(flat).filter((p) => p.startsWith(MULTI_NODE + " / "));
    expect(kids).toHaveLength(Object.keys(obtainableDrCards(CARD_DR_MULTI)).length);
    expect(flat[MULTI_NODE + " / Coralcave Guardian (Card w7a12)"]).toBeGreaterThan(0);
  });
});
