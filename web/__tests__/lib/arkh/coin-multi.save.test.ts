import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";
import type { ArkhNode } from "@/lib/arkh/node";
import { saveData } from "@/lib/arkh/state";
import { computeOverkillTier } from "@/lib/arkh/stats/systems/common/derived-damage";

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
  ])("%s", (_name, get, expected) => close(get(), expected));

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
});
