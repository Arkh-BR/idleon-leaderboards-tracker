import { describe, it, expect } from "vitest";
import { bestMap, groupedCombine, MAP_PICKS, poolsOf } from "@/scripts/_shared/gamePools";
import type { Pool } from "@/scripts/_shared/topStatCollector";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { node } from "@/lib/dropRate/node";
import type { GameEnvelope } from "@/lib/game/state";

const GROUPS = [
  { key: "m", name: "M", kind: "mult" as const, sources: ["a", "b"] },
  { key: "p", name: "P", kind: "pct" as const, sources: ["c"] },
];
const PARENTS = { m: "Root / M", p: "Root / P" };
const pools = (): Record<string, Pool> => ({
  m: { items: [node("A", 2, [node("d", 2)]), node("B", 3)] },
  p: { items: [node("C", 50)] },
});
// A one-character save with nothing in it: bestMap's scores below read only the Ctx's map.
const SAVE = {
  data: { CurrentMap_0: 1 },
  charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
} as unknown as GameEnvelope;

describe("poolsOf", () => {
  it("reads each parent's children, in order, subtrees kept", () => {
    const tree = node("Root", 9, [node("M", 6, pools().m.items), node("P", 1.5, pools().p.items)]);
    const got = poolsOf(tree, PARENTS);
    expect(got.m.items.map((i) => i.name)).toEqual(["A", "B"]);
    expect(got.m.items[0].children?.[0].name).toBe("d");
    expect(got.p.items.map((i) => i.val)).toEqual([50]);
  });

  it("reads a parent by its flattened path (#n for a repeated name)", () => {
    const tree = node("Root", 1, [node("M", 1, [node("X", 1)]), node("M", 1, [node("Y", 4)])]);
    expect(poolsOf(tree, { second: "Root / M#1" }).second.items.map((i) => i.name)).toEqual(["Y"]);
  });

  it("refuses a parent the tree does not have", () => {
    expect(() => poolsOf(node("Root", 1, [node("M", 1)]), { p: "Root / P" })).toThrow(/Root \/ P/);
  });
});

describe("groupedCombine", () => {
  const model = groupedGainsModel("Root", GROUPS);
  it("rebuilds the tree with groupVal and the total from the page's model", () => {
    const { tree, total } = groupedCombine("Root", GROUPS, model)(pools());
    const flat = flattenTree(tree);
    expect(flat["Root / M"]).toBe(6);
    expect(flat["Root / P"]).toBe(1.5);
    expect(flat["Root / M / A / d"]).toBe(2);
    expect(total).toBe(9);
    expect(flat["Root"]).toBe(9);
    expect(model.totalFromFlat(flat)).toBe(total);
  });

  it("round-trips through poolsOf", () => {
    const { tree } = groupedCombine("Root", GROUPS, model)(pools());
    expect(poolsOf(tree, PARENTS)).toEqual(pools());
  });
});

describe("bestMap", () => {
  const SCORES: Record<number, number> = { 1: 5, 2: 9, 3: 9, 4: 7 };
  const score = (c: { map: number }) => SCORES[c.map] ?? 0;
  it("picks the highest score, the lowest map on a tie", () => {
    expect(bestMap(SAVE, 0, score, () => true)).toBe(2);
  });
  it("only scores the maps it accepts", () => {
    expect(bestMap(SAVE, 0, score, (m) => m === 1 || m === 4)).toBe(4);
  });
  it("refuses a character no map passes for, saying so", () => {
    expect(() => bestMap(SAVE, 0, score, () => false)).toThrow(/no map/);
  });
  it("every score 0: the fallback gets the character's own map (CurrentMap_<ci>) and the lowest accepted one", () => {
    const seen: number[][] = [];
    expect(bestMap(SAVE, 0, () => 0, (m) => m >= 3, (own, lowest) => (seen.push([own, lowest]), 42))).toBe(42);
    expect(seen).toEqual([[1, 3]]);
  });
  it("a score above 0 never asks the fallback", () => {
    expect(bestMap(SAVE, 0, score, () => true, () => 42)).toBe(2);
  });
});

describe("MAP_PICKS", () => {
  it("DR V2 and AFK leave out the Cove (216) and non-fighting maps, AFK also Clamworks (306); EXP takes every map", () => {
    expect([216, 1, 6, 301].map(MAP_PICKS.dr2.accept)).toEqual([false, true, false, true]);
    expect([216, 306, 1, 6, 301].map(MAP_PICKS.afk.accept)).toEqual([false, false, true, false, true]);
    expect([0, 6, 216].map(MAP_PICKS.exp.accept)).toEqual([true, true, true]);
  });
  it("no map scores (lib/arkh's bestDrMapIdx / bestAfkMapIdx): the own map when accepted, else the lowest accepted (DR V2) or 301 (AFK); EXP never falls back", () => {
    const { dr2, afk, exp } = MAP_PICKS;
    expect([dr2.fallback!(1, 2), dr2.fallback!(6, 2), dr2.fallback!(216, 2)]).toEqual([1, 2, 2]);
    expect([afk.fallback!(1, 2), afk.fallback!(6, 2), afk.fallback!(306, 2)]).toEqual([1, 301, 301]);
    expect(exp.fallback).toBeUndefined();
    expect(bestMap(SAVE, 0, () => 0, dr2.accept, dr2.fallback)).toBe(1);
  });
});
