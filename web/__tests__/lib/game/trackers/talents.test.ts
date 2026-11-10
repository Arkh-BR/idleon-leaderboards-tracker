// The /talents-level tree on lib/game (lib/game/trackers/talents.ts): the plain talents, the presets and the path-by-path comparison against lib/arkh.
//
// - on a synthetic envelope (CI): an unknown id, a talent the character does not have, the star caps, the preset envelope;
// - on the newest real save (user decision 09/11: the newest save only): compareTalent for every non-pending talent of each character's class, both presets.
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GOLDEN_SAVES, goldenSaves } from "../support/arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { compareTalent, PENDING_BOOSTERS, PENDING_WRAPS } from "../support/talentCompare";
import { newestSaves } from "@/lib/diagnose/characterize";
import type { ArkhNode } from "@/lib/dropRate/node";
import { maxBookLv } from "@/lib/dropRate/explain/talent";
import { computeGameTalent, presetState } from "@/lib/game/trackers/talents";
import { stateOf } from "@/lib/game/trackers/page";
import { getCharClassKey } from "@/lib/talentsLevel/charClass";
import { TALENT_TABS_BY_CLASS } from "@/lib/talentsLevel/talentTabs.gen";
import { BASE, synth } from "../support/expStub";
import { asNumber } from "@/lib/game/attr";
import { TaskShopDesc } from "@/lib/game/data";
import { capBoosterRow } from "@/lib/talentsLevel/explain/capBoosters";
import { plainTalent } from "@/lib/talentsLevel/explain/plain";

const SPELUNK = Array.from({ length: 60 }, (_, i) => (18 === i || 45 === i ? Array<number>(10).fill(0) : []));
const envelope = (data: Record<string, unknown> = {}, chars = 1) =>
  ({
    data: { ...BASE, CurrentMap_0: -1, PlayerStuff_0: [0, 0], SL_0: {}, SM_0: {}, SLpre_0: { 24: 7 }, Spelunk: SPELUNK, ...data },
    charNames: Array.from({ length: chars }, (_, i) => `c${i}`), companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
  }) as never;
const kid = (n: ArkhNode, name: string): ArkhNode => {
  const k = n.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n.name}": ${n.children?.map((c) => c.name)}`);
  return k;
};

describe("the plain talents on a synthetic envelope (runs in CI)", () => {
  it("a talent with no formula data is a leaf saying so, not an error", () => {
    expect(computeGameTalent(envelope(), 0, 99999)).toEqual({ name: "Talent 99999", val: 0, note: "no formula data" });
  });

  it("a talent the character has not got: Active 0, and a Super Levels row with its own Active 0 and what it would give", () => {
    const t = computeGameTalent(envelope(), 0, 24);
    expect(t.name).toMatch(/\(Talent 24\)$/);
    expect(t.val).toBe(0);
    expect(kid(t, "Active").val).toBe(0);
    const lv = kid(t, "Effective Level");
    expect(lv.note).toBe("Base + Bonus + Super");
    expect(lv.children!.map((c) => c.name)).toEqual(["Base Level", "Bonus Levels", "Super Levels"]);
    const sup = kid(lv, "Super Levels");
    expect(sup.val).toBe(0);
    expect(sup.note).toMatch(/^Spelunk Super Talent — inactive \(would give \+\d+ if super-talented on this preset\)$/);
    expect(kid(sup, "Active").val).toBe(0);
  });

  it("forceSuperActive counts the super levels of a talent the preset does not list", () => {
    const t = computeGameTalent(envelope({ SL_0: { 24: 5 } }), 0, 24, { forceSuperActive: true });
    const sup = kid(kid(t, "Effective Level"), "Super Levels");
    expect(sup.val).toBeGreaterThanOrEqual(50);
    expect(kid(sup, "Active").val).toBe(1);
    expect(kid(t, "Effective Level").val).toBe(5 + sup.val + kid(kid(t, "Effective Level"), "Bonus Levels").val);
  });

  it("star 627: Max Level is 5 x (Tasks[2][0][3] + 1) over a lower saved SM", () => {
    const data = { SL_0: { 627: 3 }, SM_0: { 627: 10 }, TaskZZ2: [[0, 0, 0, 7]] };
    expect(kid(computeGameTalent(envelope(data), 0, 627), "Max Level").val).toBe(40);
  });

  it("star 641: Max Level is the live maxBookLv over a lower saved SM", () => {
    const c = synth({ SL_0: { 641: 3 }, SM_0: { 641: 1 }, TaskZZ2: [[0, 0, 0], [0, 0, 0], [0, 0, 6]], Atoms: Array<number>(20).fill(0), SaltLick: Array<number>(20).fill(0), Sailing: [[], [], [], Array<number>(40).fill(0)], Summon: [[], []], GemItemsPurchased: Array<number>(40).fill(0), Spelunk: SPELUNK, PlayerStuff_0: [0, 0] }, { map: 0 });
    const live = maxBookLv(c);
    expect(live).toBeGreaterThanOrEqual(125 + 6 * asNumber(TaskShopDesc[2][2][11]));
    expect(kid(plainTalent(c, 641), "Max Level").val).toBe(live);
  });

  it("the other preset is another state: SL is SLpre, the source and stateOf's answer stay as they were", () => {
    const save = envelope({ SL_0: { 24: 3 } });
    const before = JSON.stringify(save);
    const active = stateOf(save);
    const other = presetState(save, 0, 1);
    expect(other).not.toBe(active);
    expect(other.get("SL_0")).toEqual({ 24: 7 });
    expect((other.get("PlayerStuff_0") as number[])[1]).toBe(1);
    expect(JSON.stringify(save)).toBe(before);
    expect(stateOf(save)).toBe(active);
    expect(active.get("SL_0")).toEqual({ 24: 3 });
    expect(presetState(save, 0, 0)).toBe(active); // the active preset is the cached state
    // asking the other, then the active one: the first answer again
    const opts = { forceSuperActive: true };
    const pointsOf = (t: ArkhNode) => kid(kid(kid(t, "Effective Level"), "Base Level"), "Points Invested").val;
    expect(pointsOf(computeGameTalent(save, 0, 24, { ...opts, presetIdx: 1 }))).toBe(7);
    expect(pointsOf(computeGameTalent(save, 0, 24, { ...opts, presetIdx: 0 }))).toBe(3);
    expect(pointsOf(computeGameTalent(save, 0, 24, opts))).toBe(3);
  });

  it("a save without SLpre_0 reads the other preset as level 0, not an error", () => {
    const save = envelope({ SL_0: { 24: 3 } });
    delete (save as { data: Record<string, unknown> }).data.SLpre_0;
    expect(kid(computeGameTalent(save, 0, 24, { presetIdx: 1 }), "Active").val).toBe(0);
  });

  it("save values may be JSON strings", () => {
    const save = envelope({ SL_0: JSON.stringify({ 24: 3 }), PlayerStuff_0: JSON.stringify([0, 0]), SLpre_0: JSON.stringify({ 24: 9 }) });
    expect(presetState(save, 0, 1).get("SL_0")).toEqual({ 24: 9 });
    expect(presetState(save, 0, 1).get("PlayerStuff_0")).toEqual([0, 1]);
  });
});

describe("the cap boosters on a synthetic envelope (runs in CI)", () => {
  const CAULDRON = [[0, 2], [0, 0], [0, 0], [0, 0]];
  // blocks the booster reads: the talent curve (GetTalentNumber, getbonus2, ArbitraryCode5Inputs) runs for real, every other block (AllTalentLV...) answers 0, so a talent's level is its points
  const capOf = (data: Record<string, unknown>, id: number): ArkhNode =>
    capBoosterRow(synth({ CauldronInfo: CAULDRON, Spelunk: SPELUNK, PlayerStuff_0: [0, 0], SL_0: {}, SM_0: {}, ...data }, { map: 0, real: ["GetTalentNumber", "getbonus2", "ArbitraryCode5Inputs"] }), id, 0)!;

  it("the cap is the hardcoded base plus each booster, the source tree under the source's own name", () => {
    const cap = capOf({ SL_0: { 10: 5, 81: 4 } }, 10);
    expect(cap.children!.map((k) => k.name)).toEqual(["Base Cap (hardcoded)", "Eternal STR (Tal 51 y-bonus)", "Str Summore (Tal 81 x-bonus)", "Overblown Testosterone (Tal 143 y-bonus)"]);
    const summore = kid(cap, "Str Summore (Tal 81 x-bonus)");
    expect(summore.val).toBeGreaterThan(0);
    expect(summore.note).toBe("per-char");
    expect(summore.children!.map((k) => k.name)).toEqual(["Talent 81"].map((n) => expect.stringContaining(n)));
    expect(summore.children![0].note).toBe("per-char emit — full breakdown");
    expect(summore.children![0].val).toBe(summore.val);
    expect(cap.val).toBe(cap.children!.reduce((a, k) => a + k.val, 0));
    expect(kid(cap, "Eternal STR (Tal 51 y-bonus)").note).toBe("account-wide");
  });

  it("a bubble clamp: min(raw, CauldronInfo[chapter][slot]) with the rows Booster Raw and <label> Lv", () => {
    const cap = capOf({ SL_0: { 86: 5, 129: 60 } }, 86);
    const booster = kid(cap, "Blocky Bottles (Tal 129 x-bonus)");
    const raw = kid(booster, "Booster Raw");
    expect(raw.val).toBeGreaterThan(2);
    expect(kid(booster, "Warriors Rule (W1 bubble [0][1]) Lv").val).toBe(2);
    expect(booster.val).toBe(2);
    expect(booster.note).toBe("min(raw, bubble Lv) — per-char");
    expect(cap.val).toBe(102);
  });

  it("the saved SM is a floor: above the formula it overrides, equal it is verified, 0 leaves the formula with no row", () => {
    const base = { SL_0: { 10: 5, 81: 4 } };
    const formula = capOf(base, 10);
    expect(formula.children!.some((k) => k.name.startsWith("Saved SkillLevelsMAX"))).toBe(false);
    const over = capOf({ ...base, SM_0: { 10: formula.val + 40 } }, 10);
    expect(over.val).toBe(formula.val + 40);
    expect(kid(over, "Saved SkillLevelsMAX (override)").val).toBe(formula.val + 40);
    const same = capOf({ ...base, SM_0: { 10: formula.val } }, 10);
    expect(same.val).toBe(formula.val);
    expect(kid(same, "Saved SkillLevelsMAX (verified)").val).toBe(formula.val);
    const lower = capOf({ ...base, SM_0: { 10: 1 } }, 10);
    expect(lower.val).toBe(formula.val);
    expect(kid(lower, "Saved SkillLevelsMAX (override)").val).toBe(1);
  });

  it("a talent without a booster entry keeps the Max Book Lv Cap row", () => {
    expect(capBoosterRow(synth({ SL_0: {}, SM_0: {} }, { map: 0 }), 24, 0)).toBeNull();
    const t = computeGameTalent(envelope(), 0, 24);
    expect(kid(kid(kid(t, "Effective Level"), "Base Level"), "Max Book Lv Cap")).toBeDefined();
  });

  it("the page's tree carries the cap row of a booster target", () => {
    const t = computeGameTalent(envelope({ CauldronInfo: CAULDRON }), 0, 10);
    expect(kid(kid(kid(t, "Effective Level"), "Base Level"), "Talent Cap (base + boosters)").val).toBeGreaterThanOrEqual(100);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("compareTalent on the newest save (user decision 09/11)", () => {
  const path = () => newestSaves(goldenSaves(), 1)[0];
  const env = new Map<string, { charNames: string[] }>();
  afterAll(() => env.clear());

  for (const force of [false, true]) {
    it(`${force ? "forceSuperActive" : "plain"}: no difference outside PENDING and TALENT_KNOWN`, () => {
      const p = path();
      if (!env.has(p)) env.set(p, JSON.parse(readFileSync(p, "utf8")));
      const save = env.get(p)!;
      const out: string[] = [];
      let compared = 0;
      let skipped = 0;
      for (let ci = 0; ci < save.charNames.length; ci++) {
        const cls = TALENT_TABS_BY_CLASS[getCharClassKey(save, ci) ?? ""];
        if (!cls) continue;
        for (const id of cls.tabs.flatMap((t) => t.talents.map((e) => e.id))) {
          if (PENDING_WRAPS.has(id) || PENDING_BOOSTERS.has(id)) {
            skipped++;
            continue;
          }
          for (const presetIdx of [0, 1] as const) {
            const d = compareTalent(save, ci, id, { presetIdx, forceSuperActive: force });
            compared++;
            for (const [kind, list] of Object.entries(d)) for (const line of list) out.push(`${basename(p)}#${ci} talent ${id} preset ${presetIdx} ${kind}: ${line}`);
          }
        }
      }
      console.info(`[talent compare${force ? " forced" : ""}] ${compared} talents compared, ${skipped} skipped (wrap/booster), ${out.length} differences`);
      for (const line of out.slice(0, 30)) console.info(line);
      expect(compared).toBeGreaterThan(100);
      expect(out.slice(0, 20)).toEqual([]);
    }, 900_000);
  }
});
