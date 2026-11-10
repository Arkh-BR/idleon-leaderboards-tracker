// Synthetic golden cases: a minimal synthetic envelope and one lib/game block (or the lib/game helper the page uses) asserting the
// game's formula reacts the expected way. Catches term-level regressions that no real save covers yet.
//
// Each case runs on support/expStub's `synth`: every block not listed in `real` (key prefixes, as the Ctx cache writes them) answers 0
// unless the case seeds it, so only the term under test computes. The expected numbers are literals from the game's tables (CompanionDB,
// Research, ArmoryUpg...): a changed table or formula turns the case red, which is the point.
import { synth, WB, type Data, type Seeds } from "../../../__tests__/lib/game/support/expStub";
import type { Ctx } from "../../../lib/game/ctx";
import { ArcadeShopInfo } from "../../../lib/game/data";
import { hString } from "../../../lib/game/hstring";
import { ArbitraryCode5Inputs } from "../../../lib/game/njs/ArbitraryCode5Inputs";
import { ArcadeBonus } from "../../../lib/game/njs/ArcadeBonus";
import { ArcaneType } from "../../../lib/game/njs/ArcaneType";
import { Companions } from "../../../lib/game/njs/Companions";
import { CookingR } from "../../../lib/game/njs/CookingR";
import { FamilyBonsuesREAL } from "../../../lib/game/njs/FamilyBonsuesREAL";
import { FarmingStuffs } from "../../../lib/game/njs/FarmingStuffs";
import { Gallery } from "../../../lib/game/njs/Gallery";
import { JellyOperation } from "../../../lib/game/njs/JellyOperation";
import { MenagerieStuff } from "../../../lib/game/njs/MenagerieStuff";
import { RoyalG } from "../../../lib/game/njs/RoyalG";
import { RunCodeOfTypeXforThingY } from "../../../lib/game/njs/RunCodeOfTypeXforThingY";
import { Summoning } from "../../../lib/game/njs/Summoning";
import { emperorBonTable, Thingies } from "../../../lib/game/njs/Thingies";
import { TotalStats } from "../../../lib/game/njs/TotalStats";
import { stampDoublerTerms } from "../../../lib/game/njs/Windwalker";
import { forceTrophyChip } from "../../../lib/game/trackers/dropRateV1";
import { externalExpMulti, purpleTotal, readMasteryInputs, yellowTotal, type MasteryInputs } from "../../../lib/cookingMastery/mastery";
import { NEI32, TOME_BONUSES, TOME_TASKS } from "../../../lib/tome/tasks";

export type GoldenCase = { name: string; run: () => boolean; note: string };

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** `n` empty lists, then `at` written over them (a save list the block indexes directly). */
const lists = (n: number, at: Record<number, unknown> = {}): unknown[] => Object.assign(Array.from({ length: n }, () => [] as unknown[]), at);
/** `n` zeros, then `at` (a save row of levels). */
const zeros = (n: number, at: Record<number, number> = {}): number[] => Object.assign(Array<number>(n).fill(0), at);
/** The companion list (`envelope.companion.l`): one "id,x,x,x,stage2" entry each. */
const owns = (...entries: string[]) => ({ l: entries });
/** Research[7][9] (the Jelly obstructions cleared) at `n`: JellyOperation RoG b is on for b < n. */
const jelly = (n: number): Data => ({ Research: lists(8, { 7: zeros(10, { 9: n }) }) });
const ctx = (real: string[], data: Data = {}, o: { seeds?: Seeds; companion?: unknown; chars?: number; player?: number; map?: number } = {}): Ctx => synth(data, { ...o, real });
/** TotalStats("Drop_Rarity") over all-0 blocks with the Workbench at 1 (njs/dropRateEdges.test.ts' setup), `real` left to their code. */
const dr = (real: string[], data: Data = {}, o: { seeds?: Seeds; companion?: unknown } = {}): number =>
  TotalStats(synth({ Dream: zeros(20), ...data }, { companion: o.companion, seeds: { ...WB, ...o.seeds }, real: ['TotalStats["Drop_Rarity"]', "Dungon[", ...real] }), "Drop_Rarity");

export const CASES: GoldenCase[] = [
  {
    name: "Pet2 (companion 31) adds +15 to hat-rack multi",
    note: "guards the 2026-06 hat-rack term: Gallery(\"HatrackBonusMulti\") = 1 + (hats + Companions(31) + …)/100",
    run: () => {
      const at = (companion: unknown) => Gallery(ctx(['Gallery["HatrackBonusMulti"', "Companions["], { Spelunk: lists(60) }, { companion }), "HatrackBonusMulti", 0, 0);
      return near(at(owns()), 1) && near(at(owns("31,0,0,0,0")), 1.15);
    },
  },
  {
    name: "Royal Statue 1 (Drop Rate) = (1 + Reverence/100) · (50 + 5·(lv−1))",
    note: "guards the 2026-08 StatueBon term (Research[41]/[42] + Armory 45)",
    run: () => {
      // Statue 1 at lv 3, no armory → 50 + 5·2 = 60. Then Royal Reverence (Armory 45, +1%/lv) at lv 10 → ×1.10 = 66; statue 2 unbuilt → 0.
      const statue = (b: number, armory: number[]) => RoyalG(ctx(["RoyalG["], { RoyalG: [zeros(8, { 1: 3 }), [], armory] }), "StatueBon", b, 0);
      return near(statue(1, zeros(60)), 60) && near(statue(1, zeros(60, { 45: 10 })), 66) && statue(2, zeros(60)) === 0;
    },
  },
  {
    name: "Total Resource Grade = Σ RoyalG[5]",
    note: "guards TotalStatz(0), the multiplier of talent 239",
    run: () => RoyalG(ctx(["RoyalG["], { RoyalG: [[], [], [], [], [], [1, 2, 3, 0, 4]] }), "TotalStatz", 0, 0) === 10,
  },
  {
    name: "Companion stage 2 reads CompanionDB[id][11] (Crystal Glunko 1.3x → 1.45x DR)",
    note: "guards the 2026-08 CompanionLVz / CompanionBon switch, through Drop_Rarity's ×(1 + .3·Companions(168))",
    run: () => {
      const at = (companion: unknown) => dr(["Companions[", "CompLV2["], {}, { companion });
      return near(at(owns()), 1) && near(at(owns("168,0,0,0,0")), 1.3) && near(at(owns("168,0,0,0,1")), 1.45);
    },
  },
  {
    name: "Mama Troll (132) stage 2 adds +0.2 outside the 0.5 cap",
    note: "guards Drop_Rarity's ×(1 + min(.5, Companions(132)) + .2·CompLV2(132)); Companions(132) is also a Σ term (100, 300 at stage 2)",
    run: () => {
      const at = (companion: unknown) => dr(["Companions[", "CompLV2["], {}, { companion });
      return near(at(owns("132,0,0,0,0")), (1 + 100 / 100) * 1.5) && near(at(owns("132,0,0,0,1")), (1 + 300 / 100) * 1.7);
    },
  },
  {
    name: "Arcane Map cap never goes negative on an account without talent 589",
    note: "N.js: 100·(getbonus2(1, 589, −1) − 1) is 0 at lv 0, not −100 (which zeroed DR)",
    run: () => ArcaneType(ctx(['ArcaneType["ArcaneMapMulti_bonMAX"', "getbonus2[", "ArbitraryCode5Inputs["], { SL_0: {}, CharacterClass_0: 34 }), "ArcaneMapMulti_bonMAX", 0, 0) === 0,
  },
  {
    name: "Royal Guardian family bonus (class 16) = decay(10, 800, lv − 129)",
    note: "guards FamilyBonsuesREAL(16, 0, lv), the class curve behind FamBonusQTYs[\"32\"], the ×(1 + FB/100) DR term",
    run: () => {
      const c = ctx(["FamilyBonsuesREAL[", "ArbitraryCode5Inputs["]);
      return near(FamilyBonsuesREAL(c, 16, 0, 929), 5) && FamilyBonsuesREAL(c, 16, 0, 129) === 0; // 929 − 129 = 800: the half point, 10·800/1600
    },
  },
  // 2026-09-14: readers that used a literal instead of CompanionDB ignored stage 2. Each case moves the companion to stage 2.
  {
    name: "Rift4 (88) stage 2: prisma bubble multi term 50 → 75",
    note: "N.js PrismaBonusMult: 2 + (… + 50·Companions(88))/100, Companions(88) 1 → 1.5",
    run: () => {
      const at = (companion: unknown) => ArcaneType(ctx(['ArcaneType["PrismaBonusMult"', "Companions["], {}, { companion }), "PrismaBonusMult", 0, 0);
      return near(at(owns()), 2) && near(at(owns("88,0,0,0,0")), 2.5) && near(at(owns("88,0,0,0,1")), 2.75);
    },
  },
  {
    name: "w7a3 (42) counts 2 Lv2 showcases (3 at stage 2)",
    note: "N.js PodiumsOwned_Lv2 adds Companions(42) itself — was a +1 flag",
    run: () => {
      const at = (companion: unknown) =>
        Gallery(ctx(['Gallery["PodiumsOwned_Lv', "Companions[", "CompLV2["], { GemItemsPurchased: zeros(50), Sailing: lists(4, { 3: zeros(40) }) }, { companion }), "PodiumsOwned_Lv2", 0, 0);
      const none = at(owns());
      return at(owns("42,0,0,0,0")) - none === 2 && at(owns("42,0,0,0,1")) - none === 3;
    },
  },
  {
    name: "Reindeer (27) doubles arcade bonuses only at stage 1; Arcade Omega: level 102 = ×6 (Super 101 = ×2)",
    note: "N.js ArcadeBonus: 101==ArcadeUpg[d] ? ×2 : 102==ArcadeUpg[d] && ×6, then `1 == Companions(27)` ×2 (stage 2, 1.5, loses it)",
    run: () => {
      // ArcadeBonus(0) over the bare curve ArcadeShopInfo[0] at the same level: the multiplier alone
      const info = ArcadeShopInfo[0] as unknown as readonly unknown[];
      const multi = (level: number, companion: unknown = owns()) => {
        const c = ctx(["ArcadeBonus[", "ArbitraryCode5Inputs[", "Companions["], { ArcadeUpg: zeros(60, { 0: level }) }, { companion });
        return ArcadeBonus(c, 0) / ArbitraryCode5Inputs(c, hString(info[3]), Number(info[1]), Number(info[2]), level, 0, 0);
      };
      return (
        near(multi(100), 1) && near(multi(101), 2) && near(multi(102), 6) &&
        near(multi(100, owns("27,0,0,0,0")), 2) && near(multi(100, owns("27,0,0,0,1")), 1)
      );
    },
  },
  {
    name: "w6b2b (162) meal multi 25% → 40% at stage 2",
    note: "N.js CookingMealBonusMultioo: …×(1 + 25·Companions(162)/100), CompanionBon 1 → 1.6",
    run: () => {
      const at = (companion: unknown) => CookingR(ctx(['CookingR["CookingMealBonusMultioo"', "Companions["], {}, { companion }), "CookingMealBonusMultioo", 0, 0);
      return near(at(owns()), 1) && near(at(owns("162,0,0,0,0")), 1.25) && near(at(owns("162,0,0,0,1")), 1.4);
    },
  },
  {
    name: "Rift1 (87) stage 2: Cooking Mastery +7.5 pts (pool rounded) and ×4 Exp/h",
    note: "N.js 5·Companions(87) and (1 + 2·Companions(87)) with CompanionBon 1.5",
    run: () => {
      const c = ctx(["Companions["], { CookMaster: [[], zeros(4), zeros(6)], Meals: [zeros(80)], Ribbon: zeros(130), Lv0_0: zeros(20) }, { companion: owns("87,0,0,0,1") });
      const inp = readMasteryInputs(c);
      const stage1: MasteryInputs = { ...inp, comp87: 1 };
      return near(inp.comp87, 1.5) && purpleTotal(stage1) === inp.rank + 6 && purpleTotal(inp) === inp.rank + 9 && near(externalExpMulti(c).val, 1 + 2 * 1.5); // round(rank + 8.5)
    },
  },
  // 2026-09-18 Jelly Operator: obstruction b is active once Research[7][9] > b.
  {
    name: "Jelly Operator RoG 14 (Drop Rate) unlocks once MORE than 14 obstructions are down",
    note: "guards JellyOperation(\"RoG_BonusQTY\", b) = Research[7][9] > b ? Research[47][b] : 0",
    run: () => {
      const at = (n: number) => JellyOperation(ctx(["JellyOperation["], jelly(n)), "RoG_BonusQTY", 14, 0);
      return at(0) === 0 && at(14) === 0 && at(15) === 5;
    },
  },
  {
    name: "Drop Rate RoG factor sums Sushi 48 and Jelly 14 inside ONE (1 + x/100)",
    note: "N.js: ×(1 + (SushiStuff RoG 48 + JellyOperation RoG 14)/100)",
    run: () => near(dr([], {}, { seeds: { 'SushiStuff["RoG_BonusQTY",48,0]': 30, 'JellyOperation["RoG_BonusQTY",14,0]': 20 } }), 1.5),
  },
  {
    name: "Emperor bonus multi gains Jelly 28 (+2%) next to Arcane 48 and Arcade 51",
    note: "N.js EmperorBon: floor(sum × (1 + (Arcane48 + Arcade51 + Jelly28)/100))",
    run: () => {
      const at = (n: number) => {
        const c = ctx(['Thingies["EmperorBon"', "JellyOperation["], { ...jelly(n), OptLacc: zeros(700, { 369: 48 }) }); // one pass over the 48 emperor slots
        return { sum: emperorBonTable(c)[11], v: Thingies(c, "EmperorBon", 11, 0) };
      };
      const before = at(0);
      const after = at(72);
      return before.sum > 0 && before.v === Math.floor(before.sum) && after.v === Math.floor(after.sum * 1.02);
    },
  },
  {
    name: "Stamp Doubler adds Jelly 50 ÷ 100 (+0.01) next to Sushi RoG 17",
    note: "N.js StampDoubler: … + (SushiRoG17 + JellyRoG50/100)",
    run: () => {
      const at = (n: number) => stampDoublerTerms(ctx(["JellyOperation["], { ...jelly(n), Spelunk: lists(5, { 4: zeros(4) }) })).total;
      return near(at(72) - at(0), 0.01);
    },
  },
  {
    name: "Ribbon bonus: tier-20+ ribbons gain floor(t/20) × Jelly 60",
    note: "N.js RibbonBonus: … + floor(b/20) × JellyOperation RoG 60",
    run: () => {
      const at = (tier: number, n: number) => Summoning(ctx(['Summoning["RibbonBonus"', "JellyOperation["], jelly(n)), "RibbonBonus", tier, 0);
      return near(at(20, 72) - at(20, 0), 0.05) && near(at(19, 72) - at(19, 0), 0);
    },
  },
  {
    name: "Golden Food multi: Jelly 10 (+100%) and 51 (+200%) are additive % sources",
    note: "N.js GoldFoodBonuses rest-sum: … + Vault86 + Jelly10 + Jelly51",
    run: () => {
      const c = ctx(["JellyOperation["], jelly(72));
      return JellyOperation(c, "RoG_BonusQTY", 10, 0) === 100 && JellyOperation(c, "RoG_BonusQTY", 51, 0) === 200;
    },
  },
  {
    name: "Tome: Successful Jelly Operations at slot 121 (compute 121, 72 → 800 pts)",
    note: "NinjaInfo[32] appended 121; Tome list [121] = [72,2,800]; Unique Sushi max 64",
    run: () => {
      return (
        TOME_TASKS[121] === "Successful Jelly Operations" &&
        NEI32[121] === 121 &&
        TOME_BONUSES[121][0] === 72 &&
        TOME_BONUSES[121][2] === 800 &&
        TOME_BONUSES[116][0] === 64
      );
    },
  },
  {
    name: "Royal Guardian talents get All-Talent-LV bonus levels only up to Armory 55",
    note: "N.js AllTalMaxCapFR = ArmoryUpgBonus(55) for talents 225–239 (9999 otherwise)",
    run: () => {
      // Talent 149 (Symbols of Beyond) seeded at 6 bonus levels; Armory 55 (1 per level) caps them for talent 239, not for 149.
      const at = (t: number, armory55: number) =>
        RunCodeOfTypeXforThingY(
          ctx(['RunCodeOfTypeXforThingY["AllTalentLV"', "RoyalG["], { SL_0: { 239: 10, 149: 100 }, RoyalG: [[], [], zeros(99, { 55: armory55 })], PlayerStuff_0: [0, 0], Spelunk: lists(40), Dream: zeros(20) }, { seeds: { "GetTalentNumber[1,149]": 6 } }),
          "AllTalentLV",
          `${t}`
        );
      return at(239, 0) === 0 && at(239, 9999) === 6 && at(239, 4) === 4 && at(149, 0) === 6;
    },
  },
  {
    name: "Gallery Bonus Multi counts chip 16 per character (the game's chipBonuses(\"troph\")), and the page's chip toggle overrides it",
    note: "verified against the live game 2026-09-18: 2.27× with the chip, 2.17× without; forceTrophyChip is the /drop-rate toggle",
    run: () => {
      // char 0 wears Silkrode Motherboard (chip 16), char 1 does not.
      const data = { Lab: [[], [16, -1, -1, -1, -1, -1, -1], [10, -1, -1, -1, -1, -1, -1]], Spelunk: lists(14, { 13: zeros(5) }) };
      const multi = (player: number, force?: boolean) => {
        const c = ctx(['Gallery["GalleryBonusMulti"', "chipBonuses["], data, { chars: 2, player });
        forceTrophyChip(c, force);
        return Gallery(c, "GalleryBonusMulti", 0, 0);
      };
      return near(multi(0) - multi(1), 0.1) && near(multi(0, false), multi(1)) && near(multi(1, true), multi(0));
    },
  },
  {
    name: "Tome: Flying Worm (20) 30 → 40 talent pts, Rift Slug (1) 25 → 35 at stage 2",
    note: "the Tome star tab reads Companions(20) (CompanionDB, stage 2 = companion.l field [4])",
    run: () => {
      const val = (id: number, ...l: string[]) => Companions(ctx(["Companions["], {}, { companion: owns(...l) }), id);
      return val(20, "20,1,0,0,0") === 30 && val(20, "20,1,0,0,1") === 40 && val(1, "1,0,0,0,0", "1,0,0,0,1") === 35 && val(1) === 0;
    },
  },
  // 2026-10-16 Luminous Menagerie.
  {
    name: "Tome: 124 tasks, Menagerie Rank (122, [50,2,1200]) + Boosts Upg LV (123, [700,0,750]) appended",
    note: "N.js TomeQTY[122] = Menagerie[0][2]; TomeQTY[123] = Σ Menagerie[3]; NinjaInfo[32] appended 122, 123",
    run: () => {
      return (
        TOME_TASKS.length === 124 &&
        TOME_TASKS[122] === "Luminous Menagerie Rank" &&
        TOME_TASKS[123] === "Total Menagerie Boosts Upg LV" &&
        NEI32.length === 124 && NEI32[122] === 122 && NEI32[123] === 123 &&
        TOME_BONUSES.length === 124 &&
        TOME_BONUSES[122].join() === "50,2,1200" &&
        TOME_BONUSES[123].join() === "700,0,750"
      );
    },
  },
  {
    name: "Cooking Mastery Exp/h ×(1 + Menagerie Boost 21/100)",
    note: "N.js ExpRateCook: …*(1+MenagerieStuff(\"BoostQTY\",21,0)/100)*… (1%/level)",
    run: () => {
      const at = (lv: number) => externalExpMulti(ctx(["MenagerieStuff["], { Menagerie: [[], [], [], zeros(25, { 21: lv })] })).val;
      return near(at(30) / at(0), 1.3);
    },
  },
  {
    name: "Cooking Mastery Yellow PTS use Jelly RoG 5, Purple PTS Jelly RoG 13",
    note: "N.js PtsLeftCook_Y …+JellyOperation(\"RoG_BonusQTY\",5)… vs PtsLeftCook_P …(\"RoG_BonusQTY\",13)…",
    run: () => {
      const inp = { rank: 10, comp87: 0, evShop54: false, jelly13: 0, jelly5: 1, researchGridYellow: 0 } as MasteryInputs;
      return yellowTotal(inp) === 12 && purpleTotal(inp) === 11;
    },
  },
  {
    name: "Exotic Market doubler: Spelunk[50] lists the exotic → ×2 (Land Rank DR reads exotic 14)",
    note: "N.js ExoticBonusQTY: D.contains(Spelunk[50],e) && ExoticFarmBon[e] *= 2; LankRankUpgBonus ×(1+ExoticBonusQTY(14)/100)",
    run: () => {
      // exotic 14 at Lv 1000 → 60 × 1000/2000 = 30
      const at = (spel50: number[]) => FarmingStuffs(ctx(['FarmingStuffs["ExoticBonusQTY"'], { FarmUpg: zeros(80, { 34: 1000 }), Spelunk: lists(51, { 50: spel50 }) }), "ExoticBonusQTY", 14, 0);
      return near(at([]), 30) && near(at([14]), 60);
    },
  },
  {
    name: "DR: Menagerie Boost 24 = Research[58][24] × Menagerie[3][24]",
    note: "N.js Drop_Rarity …*(1+RoyalG(\"StatueBon\",1)/100)*(1+MenagerieStuff(\"BoostQTY\",24)/100)*…",
    run: () => {
      const at = (lv: number) => dr(["MenagerieStuff["], { Menagerie: [[], [], [], zeros(25, { 24: lv })] });
      return near(at(7), 1.07) && near(at(0), 1); // 1% a level
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
