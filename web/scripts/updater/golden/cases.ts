// Synthetic golden cases: inject minimal state and assert an engine reacts the
// expected way. Catches term-level regressions that no real save covers yet.
import { hatrackBonusMulti } from "../../../lib/arkh/stats/systems/w7/gallery";
import { compMulti } from "../../../lib/arkh/stats/systems/common/companions";
import { familyBonusValue } from "../../../lib/arkh/stats/systems/common/familyBonus";
import {
  royalStatueBon,
  totalResourceGrade,
} from "../../../lib/arkh/stats/data/w7/royalG";
import { computeArcaneMapMultiBon } from "../../../lib/arkh/stats/systems/mc/tesseract";
import { formulaEval } from "../../../lib/arkh/formulas";
import { assignSaveData } from "../../../lib/arkh/save/data";
import { saveData } from "../../../lib/arkh/state";

export type GoldenCase = { name: string; run: () => boolean; note: string };

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

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
  {
    name: "Royal Statue 1 (Drop Rate) = (1 + Reverence/100) · (50 + 5·(lv−1))",
    note: "guards the 2026-08 StatueBon term (Research[41]/[42] + Armory 45)",
    run: () => {
      // Statue 1 at lv 3, no armory → 50 + 5·2 = 60. Then Royal Reverence
      // (Armory 45, +1%/lv) at lv 10 → ×1.10 = 66.
      saveData.royalGData = [[0, 3, 0, 0, 0, 0, 0, 0], [], []];
      const bare = royalStatueBon(1, saveData);
      const armory = new Array(60).fill(0);
      armory[45] = 10;
      saveData.royalGData[2] = armory;
      const boosted = royalStatueBon(1, saveData);
      const unbuilt = royalStatueBon(2, saveData); // lv 0 → 0
      return near(bare, 60) && near(boosted, 66) && unbuilt === 0;
    },
  },
  {
    name: "Total Resource Grade = Σ RoyalG[5]",
    note: "guards TotalStatz(0), the multiplier of talent 239",
    run: () => {
      saveData.royalGData = [[], [], [], [], [], [1, 2, 3, 0, 4]];
      return totalResourceGrade(saveData) === 10;
    },
  },
  {
    name: "Companion stage 2 reads CompanionDB[id][11] (Crystal Glunko 1.3x → 1.45x)",
    note: "guards the 2026-08 CompanionLVz / CompanionBon switch",
    run: () => {
      saveData.companionIds = new Set<number>([168]);
      saveData.companionLv2Ids = new Set<number>();
      const ctx = { saveData } as any;
      const base = compMulti.resolve(168, ctx, [Infinity, 1, 0.3]).val;
      saveData.companionLv2Ids = new Set<number>([168]);
      const lv2 = compMulti.resolve(168, ctx, [Infinity, 1, 0.3]).val;
      return near(Number(base), 1.3) && near(Number(lv2), 1.45);
    },
  },
  {
    name: "Mama Troll (132) stage 2 adds +0.2 outside the 1.5 cap",
    note: "guards 1 + (min(.5, comp132) + .2·CompLV2(132))",
    run: () => {
      saveData.companionIds = new Set<number>([132]);
      saveData.companionLv2Ids = new Set<number>();
      const ctx = { saveData } as any;
      const a = compMulti.resolve(132, ctx, [1.5, 1, 1, 0.2]).val;
      saveData.companionLv2Ids = new Set<number>([132]);
      const b = compMulti.resolve(132, ctx, [1.5, 1, 1, 0.2]).val;
      return near(Number(a), 1.5) && near(Number(b), 1.7);
    },
  },
  {
    name: "Arcane Map cap never goes negative on an account without talent 589",
    note: "N.js: 100·(decayMulti(589) − 1) is 0 at lv 0, not −100 (which zeroed DR)",
    run: () => {
      // No character owns talent 589 → getbonus2 → 0 in our port; the cap must
      // clamp at the curve floor (1) so min(cap, raw) is 0, never −100.
      assignSaveData({ numCharacters: 1, charClassData: [34], skillLvData: [{}] });
      saveData.arcaneData = [];
      saveData.spelunkData = [];
      saveData.lv0AllData = [[100]];
      const v = computeArcaneMapMultiBon(0, {
        saveData,
        charIdx: 0,
        mapBon: [[100000, 0, 0]],
        mapIdx: 0,
      });
      return v >= 0;
    },
  },
  {
    name: "Royal Guardian family bonus (class 16) = decay(10, 800, bestLv − 129)",
    note: "guards FamBonusQTYs[\"32\"], the new ×(1 + FB/100) DR term",
    run: () => {
      assignSaveData({ numCharacters: 2, charClassData: [34, 16] });
      saveData.lv0AllData = [[999], [929]]; // RG at 929 → 929 − 129 = 800
      const v = familyBonusValue(16, saveData);
      const expected = formulaEval("decay", 10, 800, 800); // half-point → 5
      const noRg = (() => {
        assignSaveData({ numCharacters: 1, charClassData: [34] });
        return familyBonusValue(16, saveData);
      })();
      return v > 0 && near(v, expected) && noRg === 0;
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
