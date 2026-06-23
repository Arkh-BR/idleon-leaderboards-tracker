// Synthetic golden cases: inject minimal state and assert an engine reacts the
// expected way. Catches term-level regressions that no real save covers yet.
import { hatrackBonusMulti } from "../../../lib/arkh/stats/systems/w7/gallery";
import { saveData } from "../../../lib/arkh/state";

export type GoldenCase = { name: string; run: () => boolean; note: string };

export const CASES: GoldenCase[] = [
  {
    name: "Pet2 (companion 31) adds +15 to hat-rack multi",
    note: "guards the 2026-06 hat-rack term",
    run: () => {
      // Minimal state so hatrackBonusMulti reads zeros for everything except
      // the companion-31 term: hatCount(0) + Companions(31) + evShop30(0) +
      // minehead21(0) + sushiRoG36(0).
      //
      // hatrackBonusMulti reads:
      //   sp[46].length → hatCount         (spelunkData[46] absent → 0)
      //   stateR7[4]    → mineFloor        (stateR7 empty → 0)
      //   cachedEventShopStr               → evShop30 = 0
      //   cachedUniqueSushi                → sushiRoG36 = 0
      //   companionIds.has(31)             → comp31 = 0 before, 15 after
      //
      // Baseline: 1 + (0 + 0 + 0 + 0 + 0) / 100 = 1.0
      // After:    1 + (0 + 15 + 0 + 0 + 0) / 100 = 1.15
      saveData.spelunkData = [];
      saveData.stateR7 = [];
      saveData.cachedEventShopStr = "";
      saveData.cachedUniqueSushi = 0;
      saveData.companionIds = new Set<number>();

      const before = hatrackBonusMulti(saveData).val;
      saveData.companionIds.add(31);
      const after = hatrackBonusMulti(saveData).val;
      return Math.abs(after - before - 0.15) < 1e-9;
    },
  },
];

export function runCases(): { name: string; ok: boolean; note: string }[] {
  return CASES.map((c) => {
    let ok = false;
    try {
      ok = c.run();
    } catch {
      ok = false;
    }
    return { name: c.name, ok, note: c.note };
  });
}
