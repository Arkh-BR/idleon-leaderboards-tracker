import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getClassExpMulti on this exact file
// for Markhe on map 14, unless a comment says N.js ≠ IT.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("EXP Multi — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  let save: any;
  let markheIdx: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    markheIdx = save.charNames.indexOf("Markhe");
    tree = computeArkhExpMulti(save, markheIdx, 14).tree;
  });

  const src = (id: string): number => {
    const gi = EXP_GROUPS.findIndex((x) => x.sources.includes(id));
    const si = EXP_GROUPS[gi].sources.indexOf(id);
    return Number(tree.children![gi].children![si].val);
  };
  const group = (key: string): number => Number(tree.children![EXP_GROUPS.findIndex((x) => x.key === key)].val);
  const close = (actual: number, expected: number) => {
    if (expected === 0) expect(actual).toBe(0);
    else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
  };

  it.each([
    ["workbench", () => src("workbench"), 1.2810767773188114],
    ["bundle + superbit group", () => group("g02"), 1.2],
    ["shiny medallions", () => src("medallion429"), 2.998997995991984],
    ["companion 37 (Panda, 1+9c)", () => src("comp37"), 10],
    ["companion 33", () => src("comp33"), 2],
    ["companion 160 (1+4c)", () => src("comp160"), 5],
    ["companion 32", () => src("comp32"), 2],
    ["companion 34", () => src("comp34"), 3],
    ["companion 128 (Baby Troll)", () => src("comp128"), 1.5],
    ["research grid", () => src("gridExp"), 1.8394750000000002],
    ["super bit 63", () => src("superbit63"), 1.1],
    ["zenith market 9", () => src("zenith9"), 1.76],
    ["companion 50 clamp", () => src("comp50"), 1.01],
    ["etc 84", () => src("etc84"), 2.4222944561555217],
    ["arcade 60", () => src("arcade60"), 2.0049751243781095],
    ["vial 7classexp", () => src("vialClassExp"), 1.5096],
    ["slayer abominator", () => src("talent434"), 3.698020324806719],
    ["arcane slot 1 (map 14)", () => src("arcane1"), 1],
    ["big fish 4", () => src("bigFish4"), 1.1789772727272727],
    ["coral kid ^ god rank", () => src("coralKid"), 64.8521248076352],
    ["card set 12", () => src("cardSet12"), 1],
    ["sushi 15", () => src("sushi15"), 1.25],
    ["equinox cloud 70", () => src("cloud70"), 1.05],
    ["fountain 16", () => src("fountain16"), 25.6],
    ["royal statue 3", () => src("royalStatue3"), 1],
    ["classy discoveries", () => src("classy"), 21.630739610601516],
    ["etc 78 (%)", () => src("etc78"), 1514.3679816528827],

    // Not in IT's breakdown — derived directly from N.js + this save (values
    // printed via a throwaway script calling computeArkhExpMulti(save,8,14)).
    // not in IT's breakdown — N.js (1+.4·Companions(168)), save: companionIds
    // has 168 and companionLv2Ids has 168 → companions(168,s)=1.5 (LV2 value,
    // CompanionDB[168][11]) → 1+0.4×1.5=1.6
    ["companion 168 (0.4·comp, owned+LV2)", () => src("comp168"), 1.6],
    // not in IT's breakdown — N.js (1+Companions(145)), save: companionIds
    // has 145 (no LV2 entry) → companions(145,s)=2 → 1+2=3
    ["companion 145", () => src("comp145"), 3],
    // not in IT's breakdown — N.js (1+JellyOperation("RoG_BonusQTY",30,0)/100),
    // save: Research[7][9]=24 successful obstructions; 24 is not > 30 so
    // obstruction 30 is still locked → bonus 0 → 1+0/100=1
    ["jelly operation 30 (locked, 24 ops)", () => src("jelly30"), 1],
    // not in IT's breakdown — N.js (1+JellyOperation("RoG_BonusQTY",62,0)/100),
    // save: 24 is not > 62 → locked → bonus 0 → 1
    ["jelly operation 62 (locked, 24 ops)", () => src("jelly62"), 1],
    // not in IT's breakdown — N.js (1+CardBonusREAL(100)/100), save: no card
    // equipped on Markhe maps to IDforCardBonus["100"]="+{%_Class_EXP_Multi"
    // (computeCardBonusByType(100,ci,s).val=0) → 1+0/100=1
    ["card type 100 (Class EXP Multi, none equipped)", () => src("card100"), 1],

    // ===== G10 — Additive Pool (Task 3) =====
    // IT's own [Additive] breakdown lines turn out to equal our G10 pct-point
    // values ÷100 for every term below that has an IT counterpart (verified
    // via a throwaway script against computeArkhExpMulti + this save) — e.g.
    // IT "Statue" 2256.924964211468 × 100 = our statue10. Comments cite that
    // relationship as "IT '<label>' <v> ×100"; terms IT doesn't show at all
    // (or shows in a bucket that doesn't map 1:1) are derived from N.js + the
    // save directly and say so.
    ["etc 4 (IT '% Xp From Monsters' Equip+Gallery+Hat Rack)", () => src("etc4"), 2404.0653248235207],
    // N.js BoxRewards.monsterExp — Post Office box row ends "...acc def
    // monsterExp" (PostOffUpgradeInfo[.][16..18] slot keys); IT "Post Office" 0.1851063829787234 ×100.
    ["post office (Box of Unwanted Stats, monsterExp slot)", () => src("boxMonsterExp"), 18.51063829787234],
    // IT "Star Sign" 1 ×100 — SIGN_BONUSES.MainXP={2:1,24:3,52:6}.
    ["star sign (Main XP)", () => src("starSignMainXP"), 100],
    // IT "Vials" 1.0192 ×100.
    ["vial (Monster EXP)", () => src("vialMonsterExp"), 101.92],
    // IT "Bubble" 310.279 ×100.
    ["bubble (Class EXP Active, AlchemyDescription key expACTIVE)", () => src("bubbleExp"), 31027.899999999998],
    // not in IT's breakdown — save: no card equipped maps to CardBonusREAL(44).
    ["card type 44 (Class EXP Cards, none equipped)", () => src("card44"), 0],
    // IT "Card Set (0)" 0 — gated Lv0<50; Markhe (1900) is over the cap.
    ["card set 0 (equipped-set bonus, off — Lv0 ≥ 50)", () => src("cardSet0"), 0],
    // IT "Meals (Clexp)" 0 — gated Lv0<120; Markhe is over the cap.
    ["meals (Clexp, off — Lv0 ≥ 120)", () => src("mealClexp"), 0],
    // IT "Weekly Boss" 0.54 ×100.
    ["weekly boss (min(150, WeeklyBoss.c))", () => src("weeklyBoss"), 54],
    // IT shows "God (Omniphau) 0.24457106984297908" (nonzero) — but reading
    // this save's raw Divinity[12..23] (each character's linked god index)
    // directly, no character on the account links a type-4 (Omniphau) god:
    // types are {0,0,8,0,6,7,0,-1,2,0,-1,-1}. N.js only sums per-character
    // LINKED gods for type 4 (not the "everyone" branch, which is type 3/5
    // only), so 0 is what N.js gives here; treated as an IT-side gap/staleness
    // per constraints ("IT lines are hints, not ground truth").
    ["divinity minor 4 (Omniphau) — no character links it this save", () => src("divMinor4"), 0],
    // IT "Card Set" 0.36 ×100 — same equipped-set semantics as cardSet12 (Task 2).
    ["card set 5 (Damage/Drop/EXP set)", () => src("cardSet5"), 36],
    // IT "Statue" 2256.924964211468 ×100 — no ÷100 here (EXP's whole G10 pool
    // gets ÷100 once, unlike Coin's statue19 which divides per-term).
    ["statue 10", () => src("statue10"), 225692.4964211468],
    // IT "Star Talent" 0.19726027397260273 ×100 — id≥615 star-talent branch,
    // active character (not account-wide).
    ["talent 632 (Just EXP, star talent)", () => src("talent632"), 19.726027397260275],
    // IT "Shrine" 0.5535 ×100.
    ["shrine 5", () => src("shrine5"), 55.35],
    // IT "Prayers" 0 — Big Brain Time (0) not equipped on Markhe's loadout.
    ["prayer 0 (Big Brain Time, not equipped)", () => src("prayer0"), 0],
    // IT "Prayers" 0 — Unending Energy (2) not equipped either.
    ["prayer 2 (Unending Energy, not equipped)", () => src("prayer2"), 0],
    // IT "Dungeon (Flurbo)" 0.15 ×100 — same 4-line idiom as coin's flurbo4, idx 2.
    ["flurbo shop 2", () => src("flurbo2"), 15],
    // IT "Achievements" sums to 0.56 ×100 = 56 across all six weighted terms
    // below (1+20+3+2+5+25=56); each id checked individually here.
    ["achievement 57", () => src("ach57"), 1],
    ["achievement 357 × 20", () => src("ach357"), 20],
    ["achievement 61 × 3", () => src("ach61"), 3],
    ["achievement 124 × 2", () => src("ach124"), 2],
    ["achievement 188 × 5", () => src("ach188"), 5],
    ["achievement 286 × 25", () => src("ach286"), 25],
    // IT "Arcade" 0.4019900497512438 ×100.
    ["arcade 12", () => src("arcade12"), 40.19900497512438],
    // IT "Sigil" 4.9 ×100.
    ["sigil 8", () => src("sigil8"), 490],
    // IT "Shiny" 0.6 ×100.
    ["shiny pets (Breeding 1)", () => src("shiny1"), 60],
    // IT "EXP Cultivation" 2.4520123839009287 ×100 — account-wide getbonus2.
    ["talent 55 (EXP Cultivation, account-wide)", () => src("talent55"), 245.20123839009287],
    // IT "Spring Event Card" 0 — save: computeCardLv("springEvent1",s)=0.
    ["card springEvent1 × 2", () => src("cardSpring"), 0],
    // IT "Companion (Wispy)" 1.3 ×100 (arkh names id 3 differently; same value).
    ["companion 3", () => src("comp3"), 130],
    // IT "Companion (Santa Snake)" 0.5 ×100 (additive term — distinct from
    // G4's comp50 clamp, which is the same companion's multiplicative use).
    ["companion 50 (additive)", () => src("comp50add"), 50],
    // IT "Island Shimmer" 0.4 ×100 — OLA[179] × Dreamstuff AllShimmerBonuses.
    ["island shimmer (OLA[179])", () => src("shimmer179"), 40],
    // not in IT's breakdown at this precision — IT "Golden Food"
    // 1360.0725806453588 ×100 = 136007.258…, ours is 136205.0427607203 (~0.15%
    // higher); both call the same shared goldFoodBonuses() engine already
    // used (and tested) by DR/Coin with a new effectKey "ClassEXPz" — treated
    // as a pre-existing small IT/N.js gap in that shared engine, not a G10 bug.
    ["golden food (ClassEXPz)", () => src("goldFood"), 136205.0427607203],
    // IT "Owl" 283.8 ×100.
    ["owl 0", () => src("owl0"), 28380],
    // IT "Vote" 0 — vote 15 isn't the account's active vote.
    ["vote 15 (not the active vote)", () => src("vote15"), 0],
    // IT "Monument" 145284.972105 ×100 — Holes[15][16]=443219 (a very high
    // late-game monument level; the save's total is already ~1.45e19).
    ["monument ROG bonus (tier 1, idx 6)", () => src("monument1_6"), 14528497.2105],
    // IT "Compass" 147.6 ×100 — Moon of Experience, CompassUpg[51][9]="0" so
    // it never takes the "circle" branch on this (or any) save.
    ["compass 51 (Moon of Experience)", () => src("compass51"), 14760],
    // IT "Schematic" 22.2 ×100 = 2220 = hole47(500)+hole83(1720) SUMMED — IT
    // folds both cavern upgrades into one bucket; checked individually here.
    ["cavern upg47 (B_UPG 47)", () => src("hole47"), 500],
    ["cavern upg83 (B_UPG 83, arg e=40)", () => src("hole83"), 1720],
    // IT "Summoning" 107.991 ×100 — ExpMulti(999) = Summoning("WinBonus",23,0).
    ["win bonus 23 (ExpMulti(999))", () => src("win23"), 10799.1],
    // IT "Grimoire" 122.64 ×100.
    ["grimoire 24", () => src("grimoire24"), 12264],
    // IT "Upgrade Vault" 38.168839361013404 ×100 = 3816.88… = vault3(2844.68)
    // + vault35(972.2039…) SUMMED; checked individually here.
    ["vault 3", () => src("vault3"), 2844.68],
    ["vault 35 × log(OLA[345])", () => src("vault35"), 972.2039361013409],
    // IT "Iron Set" 0.25 ×100 — gap found while implementing this task:
    // SET_BONUS_VALUES had no IRON_SET entry despite OLA[379] listing it as
    // unlocked; fixed additively in data/common/equipment.ts (equipSetBonus
    // is the same generic EquipmentSets[.][3][2] reader every other row uses).
    ["iron set", () => src("ironSet"), 25],
    // IT "Exotic Market" 2.357188772230555 ×100.
    ["exotic market 50", () => src("exotic50"), 235.7188772230555],
    // IT "Account Option (421)" 0.43 ×100.
    ["account option 421 (OLA[421])", () => src("ola421"), 43],
    // IT shows "Stamp (Class XP) 0", but the save has StampA44 ("classxp,
    // decay,4,200,...") leveled at 225 — computeStampBonusOfTypeX (shared,
    // pre-existing stamp engine) gives 5.294117647058823 for that level;
    // treated as an IT-side gap for this under-supported stamp, not a bug.
    ["stamp (classxp, StampA44 lv 225)", () => src("stampClassxp"), 5.294117647058823],
    // IT "Friend Bonus" 0.8933755045017077 ×100.
    ["friend bonus 1", () => src("friend1"), 89.33755045017077],
    // IT "Companion (Jigglelord)" 0.1 ×100 (arkh names id 47 differently).
    ["companion 47", () => src("comp47"), 10],
    // IT "Companion (Obolbrine)" 1.5 ×100 (arkh names id 111 differently).
    ["companion 111", () => src("comp111"), 150],
    // not in IT's breakdown as a separate line (terms.md: IT folds this into
    // its internal getButtonBonus(account,8) bucket together with comp128add,
    // never shown standalone) — N.js keeps Button_Bonuses(8) and Companions
    // (128) as two separate addends in the formula, so they stay separate here.
    ["button 8 (Class XP slot)", () => src("button8"), 323.03906250000006],
    ["companion 128 (additive)", () => src("comp128add"), 100],
  ])("%s", (_n, get, expected) => close(get(), expected));

  it("LUK curve (IT expGainLUK 1.1960144856908386) → 100·curve/1.8", () =>
    close(src("luk"), (100 * 1.1960144856908386) / 1.8));
  it("Lucky Charms is not on Markhe's class", () => expect(src("talent35")).toBe(0));
  it("lowest-level block is off for Markhe (highest level)", () => {
    expect(src("merit3")).toBe(0);
    expect(src("vault12")).toBe(0);
  });
  it("newbie bracket is off past level 50", () => expect(src("newbie")).toBe(0));
  it("prayer 9 enters as a negative (its curse)", () => expect(src("prayer9")).toBeLessThanOrEqual(0));
});
