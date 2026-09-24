import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";
import type { ArkhNode } from "@/lib/arkh/node";
import { saveData } from "@/lib/arkh/state";
import { computeOverkillTier, computeMaxDamage } from "@/lib/arkh/stats/systems/common/derived-damage";
import { talent } from "@/lib/arkh/stats/systems/common/talent";
import { isFightingMap } from "@/lib/arkh/stats/data/common/maps";
import { currentMapData } from "@/lib/arkh/save/data";
import { MONSTERS } from "@/lib/arkh/stats/data/game/monsters.js";
import { formatCoinMulti } from "@/lib/coinMulti/format";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getCashMulti on this exact file for
// Markhe on map 14 (see the plan's reference table).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("Coin Multi — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  let save: any;
  let markheIdx: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    markheIdx = save.charNames.indexOf("Markhe");
    tree = computeArkhCoinMulti(save, markheIdx, 14).tree;
  });

  const src = (id: string): number => {
    const gi = COIN_GROUPS.findIndex((x) => x.sources.includes(id));
    const si = COIN_GROUPS[gi].sources.indexOf(id);
    return Number(tree.children![gi].children![si].val) || 0;
  };
  const sum = (...ids: string[]) => ids.reduce((a, id) => a + src(id), 0);
  const close = (actual: number, expected: number) => {
    if (expected === 0) expect(actual).toBe(0);
    else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
  };

  it.each([
    ["cash bubbles", () => sum("bubbleSTR", "bubbleAGI", "bubbleWIS"), 96072522.0188378],
    ["companion 24", () => src("comp24"), 5],
    ["companion 38", () => src("comp38"), 3],
    ["companion 45", () => src("comp45"), 0.5],
    ["companion 159", () => src("comp159"), 1.5],
    ["event shop 9", () => src("eventShop9"), 0.5],
    ["event shop 20", () => src("eventShop20"), 0.6],
    ["bonus money gear (etc 77)", () => src("etc77"), 136.0876673693313],
    ["sushi 18", () => src("sushi18"), 20],
    ["sushi 37", () => src("sushi37"), 40],
    ["research grid", () => sum("grid149", "grid169"), 51.9675],
    ["extra money gear (etc 100)", () => src("etc100"), 530.625],
    ["gold set", () => src("goldSet"), 50],
    // N.js ≠ IT: IT adds the miniboss skulls to Measurement 13 (IT: 74.04491048389032).
    ["gambit 7", () => src("gambit7"), 74.03532772764761],
    ["cash bundle", () => src("bunY"), 250],
    ["dust walker", () => src("dustWalker"), 478.9864015395238],
    ["meal", () => src("mealCash"), 120491.29261439998],
    ["friend 5", () => src("friend5"), 0],
    ["statue 19 ÷ 100", () => src("statue19"), 2069416.0925624787 / 100],
    ["pristine 16", () => src("pristine16"), 40],
    ["prayer 8", () => src("prayer8"), 0],
    ["talent 657", () => src("talent657"), 46.666666666666664],
    ["talents 22 + 644", () => sum("talent22", "talent644"), 1285.5296523517382],
    // N.js ≠ IT: IT treats OverkillStuffs("2") (the multikill tier, 51 here)
    // as 1. N.js's TalentCalc(643) = GetTalentNumber(1,643) × OverkillStuffs
    // ("2") (@4075410, a deterministic max-dmg-vs-AFK-target-HP tier, not a
    // live counter) — our value keeps the tier.
    ["talent 643 × multikill tier", () => src("talent643"), 1068.0194805194806],
    ["cash vial", () => src("vialCash"), 101.92],
    ["money gear (etc 3)", () => src("etc3"), 2088.704016863951],
    ["money cards", () => src("card11"), 0],
    ["arcade 10 + 11", () => sum("arcade10", "arcade11"), 60.298507462686565],
    ["post office 13c", () => src("box13c"), 23.4],
    ["guild × world", () => src("guild8"), 16.666666666666668],
    // N.js ≠ IT: N.js's GoldFoodBonuses formula (_customBlock_GoldFoodBonuses,
    // confirmed against the live N.js copy) unconditionally sums
    // JellyOperation("RoG_BonusQTY",10,0) — the Spinine (Jelly Obstruction 11)
    // +100% Golden Food term, unlocked once stateR7[9] (successful Jelly
    // Operations) exceeds 10; this save has 24. IdleonToolbox's cross-check
    // (41196.38) omits that term — our value (41256.29) matches N.js exactly
    // once it's included.
    ["golden food", () => src("goldFood"), 41256.28693615767],
    ["vault 17 × log", () => src("vault17"), 6544.72745582309],
    ["achievements", () => sum("ach235", "ach350", "ach376"), 35],
    ["vault 2", () => src("vault2"), 4657.08],
    ["ninja extra cash", () => src("ola420"), 150],
    ["flurbo 4", () => src("flurbo4"), 25],
    ["crop depot 4", () => src("cropSC4"), 31557.789495412842],
    ["pet arena 5 (×0.5) + 14", () => sum("arena5", "arena14"), 1.5],
    ["kangaroo (Roo 6)", () => src("roo6"), 8167.5],
    ["vault 14 × kills(4)", () => src("vault14"), 3349],
    ["vault 31 × kills(7)", () => src("vault31"), 2206.4],
    ["vault 34 × kills(8)", () => src("vault34"), 12292.8],
    ["vault 37 × kills(9)", () => src("vault37"), 525241.4],
    ["vault 70 × cards collected", () => src("vault70"), 8070],
    ["artifact 1 × highest level", () => src("artifact1"), 22800],
    ["mainframe 9 × green mushroom kills", () => src("mainframe9"), 17114049124783.2],
    ["vote 34 (inactive this week)", () => src("vote34"), 0],
    ["divinity minor (Cash)", () => src("divMinor3"), 5379.683449995177],
  ])("%s", (_name, get, expected) => close(get(), expected));

  it("total = IdleonToolbox's total, corrected for the four terms where IT departs from N.js", () => {
    const IT_TOTAL = 6.773746899414287e35;
    // Additive group (g23): IT's Σ plus what N.js adds on top of it —
    // 7·CardLv("w5b1") (IT omits it), talent 643's multikill tier (IT uses ×1)
    // and golden food's JellyOperation RoG 10 term (IT omits it).
    const IT_ADDITIVE = 69877.71279617335;
    const IT_TALENT643 = 20.941558441558442;
    const IT_GOLD_FOOD = 41196.37827189698;
    const delta = src("cardW5b1") + (src("talent643") - IT_TALENT643) + (src("goldFood") - IT_GOLD_FOOD);
    const additive = (1 + (IT_ADDITIVE + delta) / 100) / (1 + IT_ADDITIVE / 100);
    // Gambit 7: IT counts miniboss skulls in Measurement 13; N.js doesn't.
    const IT_GAMBIT7 = 74.04491048389032;
    const gambit = (1 + src("gambit7") / 100) / (1 + IT_GAMBIT7 / 100);
    expect(Math.abs(tree.val / (IT_TOTAL * additive * gambit) - 1)).toBeLessThan(1e-9);
  });

  it("moves only guild8 and talent643 when the viewed map changes", () => {
    const tree301 = computeArkhCoinMulti(save, markheIdx, 301).tree;
    // computeArkhCoinMulti reloads the save into the shared singleton on
    // every call; read the tier right after this one, before anything else
    // touches it.
    const tier301 = computeOverkillTier(markheIdx, { saveData, charIdx: markheIdx }, { mapIdx: 301 }).tier;

    const src301 = (id: string): number => {
      const gi = COIN_GROUPS.findIndex((x) => x.sources.includes(id));
      const si = COIN_GROUPS[gi].sources.indexOf(id);
      return Number(tree301.children![gi].children![si].val) || 0;
    };

    for (const grp of COIN_GROUPS) {
      for (const id of grp.sources) {
        if (id === "guild8" || id === "talent643") continue;
        close(src301(id), src(id));
      }
    }

    // World multi: 1 + ⌊map/50⌋ → map 14 gives ×1, map 301 gives ×7.
    close(src301("guild8"), 7 * src("guild8"));
    // Multikill tier is map-dependent (monster HP, ×5 vs ×2 exponent at
    // map ≥ 300); tv is not, so map14 / 51 × tier301 recovers it.
    close(src301("talent643"), (src("talent643") / 51) * tier301);
  });

  it("talent 643 uses the character's saved AFKtarget_N, not MapAFKtarget[map]", () => {
    // ARKHELUCK's saved map (216, The Hole) isn't a fighting map, so the
    // shared wrap (computeOverkillTier, used inside talent.resolve) forces
    // tier 1 there — but N.js OverkillStuffs("2") has no FIGHTING gate: it
    // always measures DamageDealed("Max") against the character's own
    // AFKtarget_N (their last-engaged combat target), regardless of map.
    const luckIdx = save.charNames.indexOf("ARKHELUCK");
    expect(luckIdx).toBeGreaterThanOrEqual(0);
    const savedMap = Number(currentMapData[luckIdx]);
    expect(isFightingMap(savedMap)).toBe(false);

    const ctx = { saveData, charIdx: luckIdx, activeCharIdx: luckIdx };
    // On its own (non-fighting) saved map the shared wrap's tier is 1, so
    // dividing it back out recovers the bare GetTalentNumber(1,643).
    const t0 = computeOverkillTier(luckIdx, ctx);
    expect(t0.tier).toBe(1);
    const tv = Number(talent.resolve(643, ctx).val) / t0.tier;

    const srcOf = (t: ArkhNode): number => {
      const gi = COIN_GROUPS.findIndex((x) => x.sources.includes("talent643"));
      const si = COIN_GROUPS[gi].sources.indexOf("talent643");
      return Number(t.children![gi].children![si].val) || 0;
    };

    // Map 301 (a fighting map, target = MapAFKtarget[301]): the shared
    // function already gets this right.
    const val301 = srcOf(computeArkhCoinMulti(save, luckIdx, 301).tree);
    const tier301 = computeOverkillTier(luckIdx, ctx, { mapIdx: 301 }).tier;
    expect(tier301).toBeGreaterThan(1);
    close(val301, tv * tier301);

    // Its own saved map (216): N.js measures against AFKtarget_N directly,
    // not MapAFKtarget[216] — computed here independently of coin.ts.
    const afkTargetN = String((save.data as Record<string, unknown>)["AFKtarget_" + luckIdx]);
    const hp = Number((MONSTERS as any)[afkTargetN]?.MonsterHPTotal) || 0;
    expect(hp).toBeGreaterThan(0);
    const maxDmg = computeMaxDamage(luckIdx, ctx);
    const tierVs = (monsterHP: number, dmg: number, exponent: number): number => {
      let tier = 1;
      for (let st = 0; st < 50; st++) {
        if (dmg >= monsterHP * exponent * Math.pow(exponent, st + 1)) tier = st + 2;
        else break;
      }
      return tier;
    };
    const tierSaved = tierVs(hp, maxDmg, 2);
    const valSaved = srcOf(computeArkhCoinMulti(save, luckIdx, savedMap).tree);
    close(valSaved, tv * tierSaved);
  });
});

// Reading source: in-game Upgrade Vault → "Monster Tax" → "Total Coin Bonus
// from all sources" line, read 2026-09-23. The town case reuses a COPY of
// the 05:25 UTC golden save (SAVE, above) with ONLY Markhe's current map
// moved to Blunder Hills (map 0) — no new save is downloaded.
describe.skipIf(!existsSync(SAVE))("Coin Multi matches the game's Monster Tax readings", () => {
  let save: any;
  let markheIdx: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    markheIdx = save.charNames.indexOf("Markhe");
  });

  it("Markhe on Valley of the Beans (map 14)", () => {
    const { total } = computeArkhCoinMulti(save, markheIdx, 14);
    expect(formatCoinMulti(total)).toBe("6.88E35");
  });

  it("Markhe parked in town (map 0) — AFKtarget_N keeps the multikill tier", () => {
    const townSave = JSON.parse(JSON.stringify(save));
    townSave.data["CurrentMap_" + markheIdx] = 0;
    const { total } = computeArkhCoinMulti(townSave, markheIdx, 0);
    expect(formatCoinMulti(total)).toBe("6.88E35");
  });
});

// Spec M5: talent 643's tier measures the target's live HP — the character's
// prayer curses (MonsterRespawnTimeReset @6466526) and Clamworks' Clamz_HP
// (@10887166). Markhe carries no curse, so her 6.88E35 above is unchanged.
describe.skipIf(!existsSync(SAVE))("Coin talent 643 — the game's target HP (spec M5)", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const tierOf = (name: string, map: number): number => {
    const t = computeArkhCoinMulti(save, save.charNames.indexOf(name), map).tree;
    const gi = COIN_GROUPS.findIndex((x) => x.sources.includes("talent643"));
    const n = t.children![gi].children![COIN_GROUPS[gi].sources.indexOf("talent643")];
    return Number(n.children!.find((c) => c.name === "Multikill tier (selected map)")!.val);
  };

  it("zArkhe's Jawbreaker curse (1180%, HP ×12.8): tier 21 → 19 on map 301", () => {
    expect(tierOf("zArkhe", 301)).toBe(19);
  });

  it("Clamworks (map 306) measures Clamz_HP = 1e16·30^8, not the table's 1e18: tier 18 → 4", () => {
    expect(tierOf("Markhe", 306)).toBe(4);
  });
});
