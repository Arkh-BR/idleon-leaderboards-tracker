// The Drop Rate V1 tree on lib/game (lib/game/trackers/dropRateV1.ts): the page's five top rows and its buckets.
//
// - on a synthetic envelope (CI): the root's rows, the additive pool and its buckets, Total Sum, the chip, Post-Processing's steps, the rows that follow the save, the Cove, the guard;
// - lib/dropRate/systems: buckets and the etcBonus split; newestSaves;
// - on the newest real saves (user decision 09/11: the newest saves only): the trace's notes on the page, the talents' Bonus Levels. A describe
//   body never reads a save: they load inside `it`.
import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { GOLDEN_SAVES, goldenSaves } from "../support/saves";
import { newestSaves } from "@/lib/diagnose/characterize";
import type { ArkhNode } from "@/lib/dropRate/node";
import * as systems from "@/lib/dropRate/systems";
import { talentLevelRows } from "@/lib/dropRate/explain/talent";
import { V1_COVE, V1_SOURCES, type V1Pool } from "@/lib/dropRate/v1Sources";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { assumed, makeCtx, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { TreeTotalMismatch } from "@/lib/game/errors";
import { near, stateOf } from "@/lib/game/trackers/page";
import { dropRateV1Tree, v1Assemble, v1Rows } from "@/lib/game/trackers/dropRateV1";
import { type Data, type Seeds, synth, WB } from "../support/expStub";

// the guard test makes the block disagree with its own sources once (a hook, not vi.fn: see trackers/dropRate.test.ts)
const hook = vi.hoisted(() => ({ once: null as null | ((real: (c: Ctx, d: string) => number, c: Ctx, d: string) => number) }));
vi.mock("@/lib/game/njs/TotalStats", async (orig) => {
  const actual = await orig<typeof import("@/lib/game/njs/TotalStats")>();
  return {
    ...actual,
    TotalStats: (c: Ctx, d: string) => {
      const f = "Drop_Rarity" === d ? hook.once : null;
      if (f) hook.once = null;
      return f ? f(actual.TotalStats as never, c, d) : (actual.TotalStats as (c: Ctx, d: string) => number)(c, d);
    },
  };
});

import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { skillLevel } from "@/lib/game/player";

const REAL = ['TotalStats["Drop_Rarity"]', "Dungon["];
const dream = Object.assign(Array<number>(20).fill(0), { 10: 2 });
const SET: Seeds = { ...WB, "GetTalentNumber[1,279]": 50, 'TotalStats["LUK"]': 500, 'EtcBonuses["2"]': 8 };
const tree = (data: Data = {}, seeds: Seeds = {}, o: { map?: number } = {}) => dropRateV1Tree(synth({ Dream: dream, SL_0: {}, ...data }, { ...o, seeds: { ...SET, ...seeds }, real: REAL, trace: true }));
const kid = (n: ArkhNode, name: string): ArkhNode => {
  const k = n.children?.find((c) => c.name === name);
  if (!k) throw new Error(`no "${name}" under "${n.name}": ${n.children?.map((c) => c.name)}`);
  return k;
};
const LUK_CURVE = (Math.pow(501, 0.37) - 1) / 40;
const FIVE = ["LUK Scaling", "Additive Pool", "Total Sum", "Chip Cap-Break", "Post-Processing"];

describe("the V1 tree on a synthetic envelope (runs in CI)", () => {

  it("v1Rows keeps every source's row at its position, shown or not; v1Assemble drops the unshown and builds the page's rows", () => {
    const { rows, total } = v1Rows(synth({ Dream: dream, SL_0: {} }, { seeds: SET, real: REAL, trace: true }));
    for (const p of Object.keys(rows) as V1Pool[]) expect(rows[p].map((r) => r.name), p).toHaveLength(V1_SOURCES.filter((s) => s.pool === p).length);
    expect(rows.addMain.find((r) => r.name === "EtcBonuses(102) (etcBonus 102)")?.val).toBe(0); // the Collector's positions keep it
    const { children, expected } = v1Assemble(rows);
    const page = tree();
    expect(near(expected, total)).toBe(true);
    expect(JSON.stringify(children)).not.toContain("EtcBonuses(102)");
    expect(children).toEqual(page.tree.children!.slice(0, children.length));
  });

  it("has the page's five rows, in order, and its number is the block's", () => {
    const { tree: t, total } = tree();
    expect(t).toMatchObject({ name: "Drop Rate", val: total, fmt: "x" });
    expect(t.children!.map((c) => c.name)).toEqual(FIVE);
    expect(V1_SOURCES.map((s) => s.id)).toHaveLength(new Set(V1_SOURCES.map((s) => s.id)).size);
  });

  it("LUK Scaling is 1.4 x the curve; the additive pool groups its rows by system", () => {
    const t = tree().tree;
    const luk = kid(t, "LUK Scaling");
    expect(luk).toMatchObject({ val: 1.4 * LUK_CURVE, fmt: "raw", defaultClosed: true });
    expect(luk.children).toEqual([
      { name: "🍀 Total LUK", val: 500, fmt: "raw" },
      { name: "Sub-1000 curve", val: LUK_CURVE, fmt: "raw", note: "(pow(500+1, 0.37)-1)/40" },
      { name: "× 1.4", val: 1.4 * LUK_CURVE, fmt: "raw", note: "1.4 × lukScaling" },
    ]);
    const add = kid(t, "Additive Pool");
    expect(add).toMatchObject({ val: 50 + 8 + 10, fmt: "+" }); // talent 279, EtcBonuses("2"), 5 x Dream[10]
    expect(kid(add, "🎯 Talents")).toMatchObject({ val: 50, fmt: "+" });
    expect(kid(kid(add, "🎯 Talents"), "Robbing Hood (Talent 279)")).toMatchObject({ val: 50, fmt: "+" });
    expect(kid(kid(add, "💭 Dreams"), "Equinox Symbols (Dream 10)")).toMatchObject({ val: 10, fmt: "+", note: "dream 10" });
    // the buckets follow the fixed system order (merged); an etcBonus row splits in its parts (lib/dropRate/explain/equipment), and a part this save cannot answer is a noted leaf
    expect(add.children!.map((c) => c.name).slice(0, 3)).toEqual(["🎯 Talents", "🃏 Cards", "⭐ Star Signs"]);
    expect(kid(kid(add, "🎽 Equipment"), "Equipment (etcBonus 2)")).toMatchObject({ val: 0, note: expect.stringMatching(/^not read: /) });
  });

  it("Total Sum is 1 + 1.4 x the curve + the pool / 100, with its note", () => {
    const sum = kid(tree().tree, "Total Sum");
    expect(sum.val).toBeCloseTo(1 + 1.4 * LUK_CURVE + 68 / 100, 12);
    expect(sum).toMatchObject({ fmt: "raw", note: `1 + 1.4·LUK + addSum/100  =  1 + ${(1.4 * LUK_CURVE).toFixed(2)} + 68.0 / 100  — N.js formula` });
  });

  it("the chip: Cap-Break applies only below 5, and the row shows the chip either way", () => {
    const lo = tree({}, { 'chipBonuses["dr"]': 50 });
    const cap = kid(lo.tree, "Chip Cap-Break");
    expect(cap).toMatchObject({ val: 0.5, fmt: "+", defaultClosed: true, note: "Applies when base < 5×" });
    // the synthetic envelope has no Lab: the chip's slots are a noted leaf, never a page error
    expect(cap.children).toEqual([{ name: "Lab Chip DR", val: 50, fmt: "+", note: "chip dr", children: [{ name: "Lab Chip DR", val: 0, note: "not read: Lab" }] }]);
    const hi = tree({}, { 'chipBonuses["dr"]': 50, "GetTalentNumber[1,279]": 500 });
    expect(hi.total).toBeGreaterThan(5);
    expect(kid(hi.tree, "Chip Cap-Break")).toMatchObject({ val: 0, note: "Inactive (base ≥ 5× or no chip)" });
    expect(kid(hi.tree, "Chip Cap-Break").children).toMatchObject([{ name: "Lab Chip DR", val: 50, fmt: "+", note: "chip dr" }]);
  });

  it("Post-Processing: the three steps as buckets, then the multipliers by system", () => {
    const seeds = { 'WorkbenchStuff["AdditionExtraEXPnDR",0,0]': 1.5, 'Summoning["TomeBonus",7,0]': 20, "Companions[168]": 1 };
    const { tree: t, total } = tree({ OptLacc: Object.assign(Array<number>(700).fill(0), { 232: 1 }), BundlesReceived: { bun_v: 1, bun_p: 1 } }, seeds);
    const post = kid(t, "Post-Processing");
    expect(post.children!.slice(0, 3)).toMatchObject([
      { name: "🎁 Bundles", val: 2, fmt: "+", note: "Added to Total Sum", children: [{ name: "Death Bringer Bundle (Bundle bun_v)", val: 2, fmt: "+", note: "bundle bun_v" }] },
      { name: "🎯 Talents", val: 1.5, fmt: "x", note: "Multiplies the running total", children: [{ name: "Archlord Of The Pirates (Talent 328)", val: 1.5, fmt: "x" }] },
      { name: "🥷 Sneaking Mastery", val: 0.3, fmt: "+", note: "Added to the running total", children: [{ name: "Sneaking Completions (Sneaking Mastery)", val: 0.3, fmt: "+", note: "ola 232" }] },
    ]);
    const paths = Object.keys(flattenTree(t));
    expect(paths).toContain("Drop Rate / Post-Processing / 🎁 Bundles#1 / Explorer Bundle (Bundle bun_p)"); // the second bucket of the name, as snapshots key it
    expect(kid(kid(post, "🐾 Companions"), "Crystal Glunko (Companion 168)")).toMatchObject({ val: 1.3, fmt: "x" });
    expect(kid(post, "📖 Tome")).toMatchObject({ val: 1.2, fmt: "x" }); // 1 + 20 / 100, a `+` row of a multiplicative pool
    const base = kid(t, "Total Sum").val;
    expect(post.val).toBeCloseTo(total / base, 9);
  });

  it("a row follows the save: format and note while it is 0, and the Glimbo row is the grid square until it has a value", () => {
    const { tree: t } = tree();
    const add = kid(t, "Additive Pool");
    expect(kid(kid(add, "🐾 Companions"), "Crystal Custard (Companion 3)")).toMatchObject({ name: "Crystal Custard (Companion 3)", val: 0, note: "Not owned — would grant +100" }); // and its rows say what it would grant (explain/collections.test.ts)
    expect(kid(kid(add, "🙏 Prayers"), "Midas Minded (Prayer 7)")).toMatchObject({ name: "Midas Minded (Prayer 7)", val: 0, note: "prayer 7" }); // its rows are a noted leaf here: the seeded envelope has no Prayers_0
    expect(kid(kid(add, "🏆 Achievements"), "Summoning GM (Achievement 377)").note).toBe("Not completed — would grant +6");
    expect(kid(kid(add, "📜 Stamps"), "Golden Sixes Stamp (Stamp A38)").note).toBe("Level 0 — not collected");
    const owned = kid(kid(kid(tree({}, { "Companions[3]": 130 }).tree, "Additive Pool"), "🐾 Companions"), "Crystal Custard (Companion 3)");
    expect(owned).toMatchObject({ name: "Crystal Custard (Companion 3)", val: 130, fmt: "+" });
    const post = kid(t, "Post-Processing");
    expect(kid(kid(post, "🔬 Researching"), "Glimbo Insider Trading Secrets (Grid 168)")).toEqual({ name: "Glimbo Insider Trading Secrets (Grid 168)", val: 0, note: "grid 168" });
    const levelled = kid(tree({}, { 'ResearchStuff["Grid_Bonus",168,0]': 25, 'Minehead["GlimboDRmulti",0,0]': 1.4 }).tree, "Post-Processing");
    expect(kid(kid(levelled, "🎲 Glimbo"), "Glimbo DR Multi")).toEqual({ name: "Glimbo DR Multi", val: 1.4, fmt: "x", note: "grid 168" });
  });

  it("a talent's note is its curve at the level the game reads it", () => {
    const { tree: t } = tree({ SL_0: { 279: 68 }, Dream: Object.assign(Array<number>(20).fill(0), { 10: 2, 12: 200 }) });
    expect(kid(kid(kid(t, "Additive Pool"), "🎯 Talents"), "Robbing Hood (Talent 279)").note).toBe("decay(40,65,268)");
  });

  it("the %_DROP_CHANCE row exists only while it has a value, and then the total still adds up", () => {
    const names = (s: Seeds) => kid(kid(tree({}, s).tree, "Additive Pool"), "🎽 Equipment").children!.map((c) => c.name);
    expect(names({})).toEqual(["Equipment (etcBonus 2)"]);
    expect(names({ 'EtcBonuses["102"]': 3 })).toEqual(["Equipment (etcBonus 2)", "Equipment (etcBonus 102)"]);
  });

  it("the Cove is a root row only on map 216 in cavern 17, and the total is the game's", () => {
    const rest = { 'Holes2["Cglunko_DR",0,0]': 0.5 };
    const on = tree({ Holes: [[17]] }, rest, { map: 216 });
    expect(on.total).toBe(0.5);
    expect(on.tree.val).toBe(0.5);
    expect(on.tree.children!.map((c) => c.name)).toEqual([...FIVE, V1_COVE]);
    expect(kid(on.tree, V1_COVE)).toEqual({ name: "🏝️ Crystal Glunko Cove", val: 0.5, fmt: "raw", note: "Map 216 (The Hole), cavern 17 (The Cove): replaces the whole Drop Rate" });
    for (const [data, map] of [[{ Holes: [[16]] }, 216], [{ Holes: [[17]] }, 215]] as const) {
      expect(tree(data, rest, { map }).tree.children!.map((c) => c.name)).toEqual(FIVE);
    }
  });

  it("throws TreeTotalMismatch when the tree no longer gives the block's total, and off the Cove only", () => {
    hook.once = (real, c, d) => 2 * real(c, d);
    expect(() => tree()).toThrow(TreeTotalMismatch);
    expect(() => tree()).not.toThrow();
    // float order alone never fires it: the guard is `near` (1e-9 relative)
    hook.once = (real, c, d) => real(c, d) * (1 + 1e-13);
    expect(() => tree()).not.toThrow();
  });

  it("a `runtime:` or `assumed:` note in the trace stays on the page, under the root (Ruling L)", () => {
    hook.once = (real, c, d) => {
      assumed(c, "a seeded read", "assumed for this test", 1);
      return real(c, d);
    };
    const { tree: t } = tree();
    expect(t.children!.map((n) => n.name)).toEqual([...FIVE, "a seeded read"]);
    expect(kid(t, "a seeded read").note).toMatch(/^assumed: /);
    expect(() => dropRateV1Tree(synth({ Dream: dream, SL_0: {} }, { seeds: SET, real: REAL }))).toThrow(/has none/);
  });
});

describe("lib/dropRate/systems", () => {

  it("a row's system is read from its name; a bucket name goes back to its system", () => {
    expect(systems.classifySystem("Robbing Hood (Talent 279)")).toBe("Talents");
    expect(systems.classifySystem("Royal Statue: Drop Rate")).toBe("Royal Guardian");
    expect(systems.classifySystem("Crop Depot Bonus 7 (Farming cropSC7)")).toBe("Farming");
    expect(systems.classifySystem("something else")).toBe("Other");
    expect(systems.decorateSystem("Cards")).toBe("🃏 Cards");
    expect(systems.parseSystemFromBucketName("🖼️ Gallery")).toBe("Gallery");
    expect(systems.parseSystemFromBucketName("Additive Pool")).toBeNull();
    expect(systems.systemWorld("Gallery")).toBe("World 7");
  });

  const rows: ArkhNode[] = [
    { name: "Mallay (Companion 26)", val: 1.3, fmt: "x" },
    { name: "Drop Rate Vial", val: 10, fmt: "+" },
    { name: "Santa Snake (Companion 50)", val: 1.01, fmt: "x" },
  ];
  it("merge joins a system's rows and multiplies a multiplicative bucket; runs keeps the sequence", () => {
    const merged = systems.categorizePoolItems(rows, "multiplicative", "merge");
    expect(merged.map((b) => [b.name, b.val])).toEqual([["🐾 Companions", 1.3 * 1.01], ["⚗️ Alchemy", 1.1]]);
    expect(systems.categorizePoolItems(rows, "additive", "merge")[0]).toMatchObject({ name: "🐾 Companions", val: 2.31, fmt: "+" });
    expect(systems.categorizePoolItems(rows, "multiplicative", "runs").map((b) => b.name)).toEqual(["🐾 Companions", "⚗️ Alchemy", "🐾 Companions"]);
  });

  it("an etcBonus row's parts land in their own buckets, renamed; the placeholder part goes", () => {
    const wrapper: ArkhNode = {
      name: "Drop Rate (Equipment) (etcBonus 2)",
      val: 7,
      fmt: "+",
      children: [
        { name: "Obol Bonuses", val: 3 },
        { name: "Nametag Bonuses", val: 4 },
        { name: "No active sources", val: 0 },
      ],
    };
    expect(systems.categorizePoolItems([wrapper]).map((b) => [b.name, b.children!.map((c) => c.name)])).toEqual([
      ["🪙 Obols", ["Obols (etcBonus 2)"]],
      ["🖼️ Gallery", ["Nametags (etcBonus 2)"]],
    ]);
  });
});

describe("newestSaves", () => {
  it("takes the most recently modified, newest first, and leaves the list as it was", () => {
    const dir = mkdtempSync(join(tmpdir(), "newest-"));
    try {
      const paths = ["a", "b", "c"].map((f, i) => {
        const p = join(dir, `${f}.json`);
        writeFileSync(p, "{}");
        utimesSync(p, new Date(1000 + i * 1000), new Date(1000 + i * 1000));
        return p;
      });
      const before = [...paths];
      expect(newestSaves(paths, 2).map((p) => basename(p))).toEqual(["c.json", "b.json"]);
      expect(paths).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
describe.skipIf(GOLDEN_SAVES.length === 0)("on the 5 newest saves (user decision 09/11)", () => {
  const saves = () => newestSaves(goldenSaves(), 5);
  const envelopes = new Map<string, unknown>();
  const envelope = (p: string) => {
    if (!envelopes.has(p)) envelopes.set(p, JSON.parse(readFileSync(p, "utf8")));
    return envelopes.get(p);
  };
  afterAll(() => envelopes.clear());

  it("every `runtime:` / `assumed:` note of the block's trace is on the page", () => {
    const FLAG = /^(runtime|assumed):/;
    const ofTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(ofTrace)];
    const ofTree = (n: ArkhNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(ofTree)];
    const env = envelope(saves()[0]) as { charNames: unknown[] };
    for (let ci = 0; ci < env.charNames.length; ci++) {
      const c = makeCtx(stateOf(env), { player: ci, map: 251, trace: true });
      const { tree: t } = dropRateV1Tree(c);
      expect(ofTree(t).sort()).toEqual(ofTrace(c.trace!).sort());
    }
  }, 300_000);

  it("the rows' Bonus Levels are the levels the game reads (AllTalentLV, and AllTalentLVz for the best character)", () => {
    const env = envelope(saves()[0]) as { charNames: string[] };
    let checked = 0;
    for (let ci = 0; ci < env.charNames.length; ci++) {
      const c = makeCtx(stateOf(env), { player: ci, map: 251 });
      for (const id of [24, 144, 239, 279]) {
        const level = skillLevel(c, id);
        if (0 >= level) continue;
        const eff = talentLevelRows(c, id).find((r) => r.name === "Effective Level")!;
        expect(eff.val, `${ci}/${id}`).toBe(level + RunCodeOfTypeXforThingY(c, "AllTalentLV", `${id}`));
        checked++;
      }
      const best = talentLevelRows(c, 328, { best: true })[0];
      const owner = env.charNames.indexOf(best.children![0].note!.split("owner: ")[1]);
      expect(best.val).toBe(skillLevel(c, 328, owner) + RunCodeOfTypeXforThingY(c, "AllTalentLVz", `328|${owner}`));
      checked++;
    }
    expect(checked).toBeGreaterThan(env.charNames.length);
  }, 300_000);
});
