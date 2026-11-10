// Task 4 (Coin plan): the Coin Multi adapter (lib/game/trackers/coinMulti.ts), ArbitraryCode("MonsterCash") turned into the page's tree.
//
// - the display config in lib/coinMulti/layers (Ruling B); the tracker registry;
// - on a synthetic envelope (CI): the tree's shape, the sources' values (the map-dependent guild term, the sources that read the save), the `assumed:` leaves kept
//   on the page, the recombination guard (TreeTotalMismatch), the page's Biggest Gains model giving the total back;
// - on every real save, character and map (301, 251, 150, 40 and 33: the maps of njs/coinMulti.test.ts): the total is the one ArbitraryCode("MonsterCash") call,
//   one tree node per group, the page's Biggest Gains model giving the total back from the flat tree, and every runtime: / assumed: note of the full trace kept;
// - the Coin Multi readings in the game's display format (skipped until fixtures/readings.json has a coinMulti entry, Ruling MM).
// A describe body never reads a save: states load lazily inside `it`.
import { afterAll, describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { GOLDEN_SAVES } from "../support/saves";
import * as layers from "@/lib/coinMulti/layers";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { makeCtx, type Ctx, type TraceNode } from "@/lib/game/ctx";
import { InvalidSaveValue, MissingSaveKey, TreeTotalMismatch } from "@/lib/game/errors";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { TRACKERS } from "@/lib/game/trackers";
import { coinTree, computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";
import { formatGameValue, normalizeGameText } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import type { StatResult } from "@/lib/statTracker/config";
import { type Data, type Seeds, synth } from "../support/expStub";

// the guard test makes the block disagree with its own sources once: the real block otherwise (a hook, not vi.fn: vi.fn keeps every call's arguments,
// a Ctx with its trace, which the real-save loops below would pile up past the heap)
const hook = vi.hoisted(() => ({ once: null as null | ((real: (c: Ctx, d: string) => number, c: Ctx, d: string) => number) }));
vi.mock("@/lib/game/njs/ArbitraryCode", async (orig) => {
  const actual = await orig<typeof import("@/lib/game/njs/ArbitraryCode")>();
  return {
    ...actual,
    ArbitraryCode: (c: Ctx, d: string) => {
      const f = "MonsterCash" === d ? hook.once : null;
      if (f) hook.once = null;
      return f ? f(actual.ArbitraryCode as never, c, d) : (actual.ArbitraryCode as (c: Ctx, d: string) => number)(c, d);
    },
  };
});
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";

type Node = StatResult["tree"];
const { COIN_GROUPS, COIN_ROOT, COIN_VOTE_NAME } = layers;
const rel = (got: number, want: number) => Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
const noSaves = GOLDEN_SAVES.length === 0;
const count = (n: Node): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
const FLAG = /^(runtime|assumed):/;
const flagsOfTrace = (n: TraceNode): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.value}`] : []), ...n.children.flatMap(flagsOfTrace)];
const flagsOfTree = (n: Node): string[] => [...(FLAG.test(n.note ?? "") ? [`${n.note}|${n.val}`] : []), ...(n.children ?? []).flatMap(flagsOfTree)];
const ALL_IDS = COIN_GROUPS.flatMap((g) => g.sources);
const gi = (key: string) => COIN_GROUPS.findIndex((g) => g.key === key);
const noMigrated = (note?: string) => note?.replace(/^migrated from an older game version \(\d+ load steps?\)$/, "") || undefined;

// ── the display config and the registry ─────────────────────────────────────────────────────────
describe("the display config and the registry", () => {
  it("lives in lib/coinMulti/layers: 23 groups, 57 distinct sources (Ruling B)", () => {
    expect(COIN_GROUPS).toHaveLength(23);
    expect(ALL_IDS).toHaveLength(57);
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
  });

  it("the page's Biggest Gains model reads the same config and leaves the weekly vote out", () => {
    const g = `${COIN_ROOT} / ${COIN_GROUPS[gi("g17")].name} / ${COIN_VOTE_NAME}`;
    expect(COIN_PAGE.gains.sources({ [g]: 0 }, { [g]: 30 })).toEqual([]);
  });

  it("TRACKERS.coinMulti is ArbitraryCode(\"MonsterCash\") (the Total Coin Bonus line of Upgrade Vault 2)", () => {
    expect(TRACKERS.coinMulti!(synth({}, { seeds: BASE_SEEDS, real: REAL }))).toBe(1);
  });
});

// ── the tree on a synthetic envelope (CI) ───────────────────────────────────────────────────────
// Every block the block calls answers 0 unless seeded (expStub's ZeroCache); `REAL` lists the ones left to their code: the block itself and getLOG.
// The Balloonfish factor (Stuff2 CoinDropMulti) is 1 + Companion 38, so it is seeded 1: a 0 there would zero the whole product.
const REAL = ['ArbitraryCode["MonsterCash"]', "getLOG["];
const BASE_SEEDS: Seeds = { 'Stuff2["CoinDropMulti",0,0]': 1 };
const optLacc = (at: Record<number, number>) => Object.assign(Array<number>(700).fill(0), at);
describe("the tree on a synthetic envelope (runs in CI)", () => {
  const SET: Seeds = {
    ...BASE_SEEDS, 'DNSM.AlchBubbles["CashSTR"]': 5, 'TotalStats["STR"]': 600, 'Companions[24]': 2, 'Companions[45]': 9, 'Stuff2["CoinDropMulti",0,0]': 1.5,
    'Summoning["EventShopOwned",9,0]': 1, 'Summoning["EventShopOwned",20,0]': 2, 'EtcBonuses["77"]': 20, "GuildBonuses[8]": 2, "getbonus2[1,433,-1]": 3,
    'Summoning["VaultUpgBonus",34,0]': 4, 'Summoning["VaultKillzTotal",8,0]': 6, 'Summoning["VotingBonusz",34,0]': 11, 'ArbitraryCode["StatueBonusGiven19"]': 250,
  };
  const data = { OptLacc: optLacc({ 362: 1000, 420: 7 }) };
  const tree = (extra: Data = {}, seeds: Seeds = {}, o: { map?: number; real?: string[] } = {}) =>
    coinTree(synth({ ...data, ...extra }, { map: o.map, seeds: { ...SET, ...seeds }, real: [...REAL, ...(o.real ?? [])], trace: true }));
  const val = (t: Node, group: string, id: string) => t.children![gi(group)].children![COIN_GROUPS[gi(group)].sources.indexOf(id)].val;

  it("has the page's shape: the groups in COIN_GROUPS order, each with its sources in order", () => {
    const { tree: t, total } = tree();
    expect(t).toMatchObject({ name: COIN_ROOT, val: total, fmt: "x" });
    expect(noMigrated(t.note)).toBeUndefined();
    expect(t.children!.map((c) => c.name)).toEqual(COIN_GROUPS.map((g) => g.name));
    COIN_GROUPS.forEach((g, i) => expect(t.children![i].children, g.key).toHaveLength(g.sources.length));
    expect(t.children!.map((g) => g.fmt)).toEqual(COIN_GROUPS.map(() => "x"));
    expect(t.children![gi("g01")].note).toBe("× (1 + Σ/100)");
    expect(t.children![gi("g02")].note).toBe("× (1 + min(4, Σ))");
    expect(t.children![gi("g03")].note).toBe("× (1 + Σ) · Coin drop multi");
    expect(t.children![gi("g11")].note).toBe("× (1 + Σ/100) · Research Grids 149 and 169");
    // the sources: percentage points in the pct groups, the bare value the raw and min4 groups add to their 1
    expect(val(t, "g01", "bubbleSTR")).toBe(5 * 2); // 5 x floor(600 / 250)
    expect(val(t, "g02", "comp24")).toBe(2);
    expect(val(t, "g03", "comp38")).toBe(0.5); // Stuff2("CoinDropMulti") is 1 + Companion 38
    expect(val(t, "g04", "comp45")).toBe(9); // the group applies min(4, .)
    expect(t.children![gi("g04")].val).toBe(5);
    expect(val(t, "g06", "eventShop9")).toBe(0.5);
    expect(val(t, "g07", "eventShop20")).toBe(1.2);
    expect(val(t, "g16", "dustWalker")).toBeCloseTo((3 * Math.log(1000)) / 2.30259, 12);
    expect(val(t, "g18", "statue19")).toBe(2.5); // the Pecunia statue is /100, the others are not
    expect(val(t, "g19", "vault34")).toBe(24);
    expect(val(t, "g17", "vote34")).toBe(11);
    expect(val(t, "g23", "ola420")).toBe(7);
    // a source carries the call it stands for: block and arguments, its value; a read of the save is a leaf with a note
    expect(t.children![gi("g08")].children![0].children).toEqual([{ name: 'EtcBonuses("77")', val: 20, fmt: "raw", note: "cached" }]);
    expect(t.children![gi("g23")].children![COIN_GROUPS[gi("g23")].sources.indexOf("ola420")].children).toEqual([
      { name: "OptionsListAccount[420]", val: 7, fmt: "raw", note: "Hoops shop level" },
    ]);
    // the weekly vote keeps its name, the one the page ranks around
    expect(t.children![gi("g17")].children![3].name).toBe(COIN_VOTE_NAME);
    // the page's Biggest Gains model gives the total back from the flat tree
    expect(COIN_PAGE.gains.totalFromFlat(flattenTree(t))).toBeCloseTo(total, 12);
  });

  it("the guild term follows the map: GuildBonuses(8) x (1 + floor(map / 50)), and the formats are the page's", () => {
    for (const [map, world] of [[301, 7], [251, 6], [150, 4], [40, 1], [0, 1]] as const) {
      const { tree: t, total } = tree({}, {}, { map });
      expect(val(t, "g23", "guild8"), `map ${map}`).toBe(2 * world);
      expect(t.val).toBe(total);
    }
    const { tree: t } = tree();
    const raws = ["comp24", "comp38", "comp45", "comp159", "eventShop9", "eventShop20", "arena5", "arena14", "statue19"];
    COIN_GROUPS.forEach((g, i) => g.sources.forEach((id, k) => expect(t.children![i].children![k].fmt, id).toBe(raws.includes(id) ? "raw" : "+")));
  });

  it("the `assumed:` leaves stay on the page, inside the source whose call reaches them", () => {
    // Stuff2("CardsCollected") left to its code counts the cards of the save and says so (DNSM.UnqCardzCol): the Collection Cashout source keeps that note
    const { tree: t } = tree({ Cards0: {} }, { 'Summoning["VaultUpgBonus",70,0]': 3 }, { real: ['Stuff2["CardsCollected"'] });
    const src = t.children![gi("g23")].children![COIN_GROUPS[gi("g23")].sources.indexOf("vault70")];
    expect(flagsOfTree(src)).toHaveLength(1);
    expect(flagsOfTree(src)[0]).toMatch(/^assumed: cards collected, counted from the save/);
    expect(src.children!.map((c) => c.name)).toEqual(['Summoning("VaultUpgBonus", 70, 0)', 'Stuff2("CardsCollected", 0, 0)']);
    expect(flagsOfTree(t)).toEqual(flagsOfTree(src)); // and nowhere else
  });

  it("Coins For Charon says the map and the AFK target its tier used, as the map picker showed it; a term of 0 says nothing", () => {
    const charon = (t: Node) => t.children![gi("g23")].children![COIN_GROUPS[gi("g23")].sources.indexOf("talent643")];
    const save = { CurrentMap_0: 301, AFKtarget_0: "w7a1" };
    const on = { "TalentCalc[643]": 6 };
    expect(charon(tree(save, on, { map: 301 }).tree).note).toBe("Map 301 · target w7a1");
    expect(charon(tree(save, on, { map: 251 }).tree).note).toBe("Map 251 · target w6a1"); // another map: its own target, not the saved one
    expect(charon(tree(save, {}, { map: 301 }).tree).note).toBeUndefined();
  });

  it("the total is the one ArbitraryCode(\"MonsterCash\") call: the tree adds no second computation", () => {
    const c = synth(data, { seeds: SET, real: REAL, trace: true });
    const { total } = coinTree(c);
    expect(total).toBe(ArbitraryCode(synth(data, { seeds: SET, real: REAL }), "MonsterCash"));
    expect(c.trace!.children.filter((n) => n.block === "ArbitraryCode" && n.args[0] === "MonsterCash" && n.note !== "cached")).toHaveLength(1);
    // the tree is read from the trace: a Ctx without one is refused
    expect(() => coinTree(synth(data, { seeds: SET, real: REAL }))).toThrow(/no trace|has none/);
  });

  // The sources redo none of the block's arithmetic, but the page's Biggest Gains rebuilds the total from the tree's numbers. If the sources no
  // longer give the call's total the tree must not be shown (spec section 4): here the call's answer moves and its sources do not.
  it("throws TreeTotalMismatch when the tree no longer gives the call's total", () => {
    hook.once = (real, c, d) => 2 * real(c, d);
    let caught: unknown;
    try {
      tree();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TreeTotalMismatch);
    expect((caught as TreeTotalMismatch).rebuilt * 2).toBeCloseTo((caught as TreeTotalMismatch).total, 9);
    expect(() => tree()).not.toThrow();
  });
});

// ── every real save, character and map ──────────────────────────────────────────────────────────
/** The maps of njs/coinMulti.test.ts: the Observed Max reference, plain, a town, a dungeon (Ruling Y). Map 33 has no monster on its target: refused, below. */
const MAPS = [301, 251, 150, 40];
const HOURZERO: string[] = []; // HourZero is out of the default corpus (PARITY_EXCLUDED, support/saves.ts): nothing is refused

const states = new Map<string, ReturnType<typeof buildGameState>>();
afterAll(() => states.clear());
const stateOf = (path: string) => {
  let s = states.get(path);
  if (!s) states.set(path, (s = buildGameState(JSON.parse(readFileSync(path, "utf8")) as GameEnvelope)));
  return s;
};

describe.skipIf(noSaves)("computeGameCoinMulti on every real save, character and map", () => {
  for (const map of MAPS) {
    it(`map ${map}`, () => {
      const t0 = performance.now();
      const mismatches: string[] = [];
      const shapeMismatches: string[] = [];
      const display: string[] = [];
      const lost: string[] = [];
      const refused = new Set<string>();
      let pairs = 0;
      let flags = 0;
      let worst = 0;
      for (const path of GOLDEN_SAVES) {
        const file = basename(path);
        const state = stateOf(path);
        for (let ci = 0; ci < state.charNames.length; ci++) {
          const ctx = makeCtx(state, { player: ci, map, trace: true });
          let r: StatResult;
          try {
            r = coinTree(ctx);
          } catch (e) {
            if (!(e instanceof MissingSaveKey)) throw e;
            refused.add(`${file}: ${e.key}`);
            continue;
          }
          pairs++;
          const tree = r.tree;
          const at = `${file}#${ci}@${map}`;
          // the total is the call's (the adapter adds nothing)
          if (r.total !== TRACKERS.coinMulti!(makeCtx(state, { player: ci, map }))) mismatches.push(`${at}: the tree's total is not ArbitraryCode("MonsterCash")'s`);
          const full = flagsOfTrace(ctx.trace!).sort();
          flags += full.length;
          if (JSON.stringify(flagsOfTree(tree).sort()) !== JSON.stringify(full)) lost.push(`${at}: full trace ${full.length} notes, page tree ${flagsOfTree(tree).length}`);
          if (tree.children!.length !== COIN_GROUPS.length) shapeMismatches.push(`${at}: ${tree.children!.length} children (extras: ${tree.children!.slice(COIN_GROUPS.length).map((c) => c.name)})`);
          // display and value agree: the page's Biggest Gains model gives the total back from the flat tree
          const fromFlat = COIN_PAGE.gains.totalFromFlat(flattenTree(tree));
          worst = Math.max(worst, Math.abs(fromFlat - r.total) / Math.max(1, Math.abs(r.total)));
          if (!rel(fromFlat, r.total)) display.push(`${at}: the flat tree gives ${fromFlat}, the call ${r.total}`);
          if (tree.val !== r.total) display.push(`${at}: root ${tree.val} is not the total ${r.total}`);
        }
      }
      states.clear(); // 106 states (each a deep clone) kept across the maps would pass the heap
      console.info(
        `[coin adapter @${map}] ${pairs} pairs, ${mismatches.length} total and ${shapeMismatches.length} shape mismatches, ${flags} flagged notes, worst flat-tree error ${worst.toExponential(2)}, ${refused.size} refused, ${Math.round(performance.now() - t0)} ms`
      );
      expect(mismatches.slice(0, 20)).toEqual([]);
      expect(shapeMismatches.slice(0, 20)).toEqual([]);
      expect(display.slice(0, 20)).toEqual([]);
      expect(lost.slice(0, 20)).toEqual([]);
      expect(pairs, "saves x characters, less the refused").toBe(1153);
      // the Tome refusal behind TotalStats("STR") (Ruling E): HourZero on every map
      expect([...refused].sort()).toEqual(HOURZERO);
    }, 3_600_000);
  }

  it("map 33: no monster on its target, so the tracker refuses every character as the block does", () => {
    const invalid = new Set<string>();
    const refused = new Set<string>();
    const answered: string[] = [];
    let threw = 0;
    for (const path of GOLDEN_SAVES) {
      const state = stateOf(path);
      for (let ci = 0; ci < state.charNames.length; ci++) {
        try {
          answered.push(`${basename(path)}#${ci}: ${coinTree(makeCtx(state, { player: ci, map: 33, trace: true })).total}`);
        } catch (e) {
          if (e instanceof InvalidSaveValue) {
            threw++;
            invalid.add(e.message);
          } else if (e instanceof MissingSaveKey) refused.add(`${basename(path)}: ${e.key}`);
          else throw e;
        }
      }
    }
    console.info(`[coin adapter @33] ${threw} refused (InvalidSaveValue) ${JSON.stringify([...invalid])}, ${refused.size} refused for other reasons, ${answered.length} answered`);
    expect(answered.slice(0, 20)).toEqual([]);
    expect([...invalid], "the cause: map 33's AFK target, not any other bad value").toEqual(['AFKtarget: expected a MonsterDefinitions key, got string "Z"']); // MapAFKtarget[33]
    expect(threw).toBe(1153);
    expect([...refused].sort()).toEqual(HOURZERO);
  }, 1_800_000);
});

// ── the game's own text ─────────────────────────────────────────────────────────────────────────
// No Coin Multi in-game reading is recorded yet (the controller records them, Ruling MM): the test skips cleanly while fixtures/readings.json has no
// coinMulti entry, and runs the day one is added. A row listing "coinMulti" in `knownGaps` keeps the exact assert and runs through it.fails.
describe("the Coin Multi readings, through the adapter (Upgrade Vault 2, Monster Tax)", () => {
  const rows = loadReadings().filter((r) => r.stat === "coinMulti");
  if (rows.length === 0) it.skip("no coinMulti reading in fixtures/readings.json yet (Ruling MM)", () => {});
  for (const r of rows) {
    const run = !existsSync(join(READINGS_DIR, r.saveFile)) ? it.skip : r.knownGaps?.includes("coinMulti") ? it.fails : it;
    run(`${r.id}: ${r.game}`, () => {
      const { total } = computeGameCoinMulti(readingSave(r), r.charIdx, r.map);
      const site = formatGameValue("coinMulti", { value: total });
      console.info(`[coin adapter] ${r.id}: game ${r.game}, ours ${site}`);
      expect(normalizeGameText(site)).toBe(normalizeGameText(r.game));
    });
  }
});
