// The collectors' round trip on the newest local save (skipped without the private saves in golden/.cache): for each collector,
// combine(computePools(save, ci)) gives the tracker's total and the tracker's flat tree at item level and above. Tasks 3-5 add a row per collector
// to CASES.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bestMap, groupedCombine, MAP_PICKS, pickMap, poolsOf } from "@/scripts/_shared/gamePools";
import type { StatCollectorConfig } from "@/scripts/_shared/topStatCollector";
import { newestSaves } from "@/lib/diagnose/characterize";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { listCharacters } from "@/lib/dropRate/extract";
import type { StatResult } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";
import { near, stateOf } from "@/lib/game/trackers/page";
import { makeCtx } from "@/lib/game/ctx";
import { MapAFKtarget } from "@/lib/game/data";
import { COIN_CLASS_TALENTS, COIN_GROUPS, COIN_ROOT } from "@/lib/coinMulti/layers";
import { EXP_CLASS_TALENTS } from "@/lib/expMulti/layers";
import { DR2_CLASS_TALENTS } from "@/lib/dropRateV2/layers";
import { computeGameExpMulti } from "@/lib/game/trackers/expMulti";
import { computeGameDropRate } from "@/lib/game/trackers/dropRate";
import { computeGameArtifactFind } from "@/lib/game/trackers/artifactFind";
import { COIN_COLLECTOR } from "@/scripts/update-top-coin";
import { EXP_COLLECTOR } from "@/scripts/update-top-exp";
import { DR2_COLLECTOR } from "@/scripts/update-top-dr2";
import { ARTIFACT_COLLECTOR } from "@/scripts/update-top-artifact";
import { computeGameDamage } from "@/lib/game/trackers/damage";
import { computeGameAfkGains } from "@/lib/game/trackers/afkGains";
import { computeGameMultikill } from "@/lib/game/trackers/multikill";
import { DMG_CLASS_TALENTS, DMG_COLLECTOR_MAP } from "@/lib/damage/layers";
import { AFK_CLASS_TALENTS } from "@/lib/afkGains/layers";
import { MK_CLASS_TALENTS, MK_COLLECTOR_MAP } from "@/lib/multikill/layers";
import { DMG_COLLECTOR } from "@/scripts/update-top-damage";
import { AFK_COLLECTOR } from "@/scripts/update-top-afk";
import { MK_COLLECTOR } from "@/scripts/update-top-multikill";
import { computeGameDropRateV1 } from "@/lib/game/trackers/dropRateV1";
import { V1_CLASS_TALENTS } from "@/lib/dropRate/v1Sources";
import { collectDrReference, DR_V1_ENGINE } from "@/scripts/update-top-dr";
import { buildDrCardInputs, selectTop8DrCards } from "@/scripts/_shared/top8DrCards";
import { equippedCards } from "@/lib/game/njs/CardBonusREAL";
import { getCharClassKey } from "@/lib/talentsLevel/charClass";

const DIR = "scripts/updater/golden/.cache";
const newest = existsSync(DIR) ? newestSaves(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => join(DIR, f)), 1)[0] : undefined;
const save = newest ? JSON.parse(readFileSync(newest, "utf8").replace(/^﻿/, "")) : undefined;
const chars = save ? listCharacters(save) : [];

/** The flat tree from 1 to `depth` segments below the root (the pools' items sit at depth 2 in a grouped tree). The root is the total, checked with `near`:
 *  the collector's comes from the page model, the tracker's from N.js, a few ulps apart. */
const upTo = (flat: Record<string, number>, depth: number) => Object.fromEntries(Object.entries(flat).filter(([p]) => p.includes(" / ") && p.split(" / ").length <= depth + 1));

/** A node that only carries a runtime: / assumed: note (lib/game/trackers/page.ts `flagged`, on the page's tree). */
const flaggedNode = (n: StatResult["tree"]): boolean => /^(runtime|assumed):/.test(n.note ?? "") || (n.children ?? []).some(flaggedNode);

/** A collector's round trip: its pools recombined against the tracker on the same character. `depth`: the pools' items' depth below the root.
 *  `talents`: the class talents the runner gates by node name ("(Talent n)"), each an item of the pools. */
type Case = { name: string; cfg: Pick<StatCollectorConfig, "computePools" | "combine">; tracker: (save: unknown, ci: number) => StatResult; depth: number; talents: readonly number[] };
const CASES: Case[] = [
  { name: "Coin Multi (map 301)", cfg: COIN_COLLECTOR, tracker: (s, ci) => computeGameCoinMulti(s, ci, 301), depth: 2, talents: COIN_CLASS_TALENTS },
  { name: "EXP Multi (best EXP map)", cfg: EXP_COLLECTOR, tracker: (s, ci) => computeGameExpMulti(s, ci, pickMap(s, ci, MAP_PICKS.exp)), depth: 2, talents: EXP_CLASS_TALENTS },
  { name: "Drop Rate V2 (best DR map)", cfg: DR2_COLLECTOR, tracker: (s, ci) => computeGameDropRate(s, ci, pickMap(s, ci, MAP_PICKS.dr2)), depth: 2, talents: DR2_CLASS_TALENTS },
  { name: "Artifact Find (no map)", cfg: ARTIFACT_COLLECTOR, tracker: computeGameArtifactFind, depth: 2, talents: [] },
  // the Weapon Power / Primary Stat talents sit inside their composite sources, no node of their own (update-top-damage.ts' known residual)
  { name: "Damage (map 251)", cfg: DMG_COLLECTOR, tracker: (s, ci) => computeGameDamage(s, ci, DMG_COLLECTOR_MAP), depth: 3, talents: DMG_CLASS_TALENTS.filter((t) => ![95, 455, 20, 97, 277, 457, 5, 24].includes(t)) },
  { name: "AFK Gains (best AFK map)", cfg: AFK_COLLECTOR, tracker: (s, ci) => computeGameAfkGains(s, ci, pickMap(s, ci, MAP_PICKS.afk)), depth: 2, talents: AFK_CLASS_TALENTS },
  { name: "Multikill (map 251)", cfg: MK_COLLECTOR, tracker: (s, ci) => computeGameMultikill(s, ci, MK_COLLECTOR_MAP), depth: 2, talents: MK_CLASS_TALENTS },
  // the rows sit under a bucket (Additive Pool / 🎯 Talents / …) or a root row (Chip Cap-Break / Lab Chip DR)
  { name: "Drop Rate V1 (best DR map, chip on)", cfg: DR_V1_ENGINE, tracker: (s, ci) => computeGameDropRateV1(s, ci, pickMap(s, ci, MAP_PICKS.dr2), { chipGalleryActive: true }), depth: 3, talents: V1_CLASS_TALENTS },
];

describe.skipIf(!save)("the collectors' round trip on the newest save", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_n, c) => {
    for (const ch of chars) {
      const want = c.tracker(save, ch.charIndex);
      const pools = c.cfg.computePools(save, ch.charIndex);
      const got = c.cfg.combine(pools);
      expect(near(got.total, want.total)).toBe(true);
      // the tracker's root also lists the flagged reads no source took (Damage's masterclass-form head guards): notes, no pool, dropped
      const extras = want.tree.children!.filter((n) => !got.tree.children!.some((g) => g.name === n.name));
      for (const n of extras) expect(flaggedNode(n), n.name).toBe(true);
      const theirs = upTo(flattenTree({ ...want.tree, children: want.tree.children!.filter((n) => !extras.includes(n)) }), c.depth);
      const ours = upTo(flattenTree(got.tree), c.depth);
      expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
      // a group's value is the page's left-to-right sum, the tracker's N.js's nesting (Multikill's P′): a few ulps apart
      for (const p in theirs) expect(near(ours[p], theirs[p]), `${p}: ${ours[p]} vs ${theirs[p]}`).toBe(true);
      const items = Object.values(pools).flatMap((p) => p.items.map((i) => i.name));
      for (const id of c.talents) expect(items.some((n) => n.endsWith(`(Talent ${id})`)), `talent ${id}`).toBe(true);
    }
  });

  it("poolsOf + groupedCombine rebuild a grouped tracker's tree and total (Coin, map 301)", () => {
    const parents = Object.fromEntries(COIN_GROUPS.map((g) => [g.key, `${COIN_ROOT} / ${g.name}`]));
    const combine = groupedCombine(COIN_ROOT, COIN_GROUPS, groupedGainsModel(COIN_ROOT, COIN_GROUPS));
    const want = computeGameCoinMulti(save, chars[0].charIndex, 301);
    const got = combine(poolsOf(want.tree, parents));
    expect(near(got.total, want.total)).toBe(true);
    expect(upTo(flattenTree(got.tree), 2)).toEqual(upTo(flattenTree(want.tree), 2));
  });

  it("DR V1 keeps its rules: 279 / 24 gated into profiles, at most 8 cards, the ES profile with the Family Bonus 68 graft", () => {
    const r = collectDrReference([{ name: "newest", save }]);
    expect(r.scanned).toBe(1);
    expect(r.refusedChars).toEqual([]);
    expect(r.gated.map((g) => g.id).sort()).toEqual([24, 279]);
    const has = (m: Record<string, number>, id: number) => Object.keys(m).some((p) => p.endsWith(`(Talent ${id})`));
    expect(has(r.baseFlat, 279) || has(r.baseFlat, 24)).toBe(false);
    expect(has(r.overrides.t279, 279) && !has(r.overrides.t279, 24)).toBe(true);
    expect(has(r.overrides.t24, 24)).toBe(true);
    expect(r.overrides.t279["Drop Rate"]).toBeGreaterThan(r.baseFlat["Drop Rate"]);
    // the 8 slots: the two card nodes carry at most 8 valued cards, and the additive node is their sum
    const ADD = "Drop Rate / Additive Pool / 🃏 Cards / Drop Rate Cards (Card Type 10)";
    const MUL = "Drop Rate / Post-Processing / 🃏 Cards / Drop Rate Multi Cards (Card Type 101)";
    const cards = (node: string) => Object.entries(r.baseFlat).filter(([p, v]) => p.startsWith(node + " / ") && /\(Card [^)]+\)$/.test(p) && 0 < v);
    expect(cards(ADD).length + cards(MUL).length).toBeLessThanOrEqual(8);
    expect(near(cards(ADD).reduce((a, [, v]) => a + v, 0), r.baseFlat[ADD])).toBe(true);
    // ARKHE's save has two Elemental Sorcerers: their buffed Family Bonus 68 makes the ES profile
    expect(r.classProfile.Elemental_Sorcerer).toBe("ES");
    expect(r.fbGrafted).toBeGreaterThan(0);
    expect(Object.keys(r.overrides.ES).some((p) => p.endsWith("Family Bonus 68 (Mage)"))).toBe(true);
    expect(r.overrides.ES["Drop Rate"]).toBeGreaterThan(r.baseFlat["Drop Rate"]);
  });

  // The 8 slots read the star levels of the DR cards the scanned non-ES characters EQUIP (the tree's "(Card key) / Star Lv" leaves, CardBonusREAL's
  // CardLv, as lib/arkh's tree had them). ARKHE's saves of 03/11 equip none, so it takes the 5 newest: 01/11's Markhe equips 6.
  it("DR V1: the card rows carry the best 8 of the equipped cards' game star levels", () => {
    const five = newestSaves(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => join(DIR, f)), 5).map((f) => ({ name: f, save: JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) }));
    const r = collectDrReference(five);
    const lv = new Map<string, number>();
    for (const { save: s } of five)
      for (const ch of listCharacters(s)) {
        if (getCharClassKey(s, ch.charIndex) === "Elemental_Sorcerer") continue;
        const ctx = makeCtx(stateOf(s), { player: ch.charIndex, map: 0 });
        for (const key of ["+{%_Total_Drop_Rate", "+{%_Drop_Rate_Multi"]) for (const e of equippedCards(ctx, key)) lv.set(e.card, Math.max(lv.get(e.card) ?? 0, e.level));
      }
    const { multi, add } = buildDrCardInputs((k) => lv.get(k) ?? 0);
    const want = selectTop8DrCards(multi, add);
    expect(want.picks.length).toBeGreaterThan(0);
    const ADD = "Drop Rate / Additive Pool / 🃏 Cards / Drop Rate Cards (Card Type 10)";
    const MUL = "Drop Rate / Post-Processing / 🃏 Cards / Drop Rate Multi Cards (Card Type 101)";
    const rows = Object.entries(r.baseFlat).filter(([p, v]) => 0 < v && (p.startsWith(ADD + " / ") || p.startsWith(MUL + " / ")) && /\(Card [^)]+\)$/.test(p));
    expect(rows.map(([p, v]) => [p.match(/\(Card ([^)]+)\)$/)![1], v]).sort()).toEqual(want.picks.map((p) => [p.key, p.effVal]).sort());
    expect(near(r.baseFlat[ADD], want.additiveSum) && near(r.baseFlat[MUL], want.multiSum)).toBe(true);
  });

  it("DR V1: a character the engine refuses is counted and named, and the run goes on", () => {
    const engine = { ...DR_V1_ENGINE, computePools: (s: unknown, ci: number) => (ci === chars[1].charIndex ? (() => { throw new Error("MissingSaveKey: test"); })() : DR_V1_ENGINE.computePools(s, ci)) };
    const r = collectDrReference([{ name: "newest", save }], engine);
    expect(r.refusedChars).toEqual([`newest/${chars[1].charName}`]);
    expect(r.scanned).toBe(1);
  });

  it("bestMap picks an accepted map no other accepted map outscores (DR V2)", () => {
    const { score, accept } = MAP_PICKS.dr2;
    const ci = chars[0].charIndex;
    const m = bestMap(save, ci, score, accept);
    expect(accept(m)).toBe(true);
    const at = (map: number) => score(makeCtx(stateOf(save), { player: ci, map }));
    for (let o = 0; o < MapAFKtarget.length; o++) if (accept(o)) expect(at(o)).toBeLessThanOrEqual(at(m));
  });
});
