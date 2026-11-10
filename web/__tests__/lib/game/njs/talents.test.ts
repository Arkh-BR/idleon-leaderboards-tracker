// Task 4 (Damage plan): the talent and buff terms DamageDealed("Max") reads, TalentCalc(31, 110, 125, 485, 305, 470, 656, 616) and the
// buffs 195, 420, 585 and 615 of GetBuffBonuses, on hand-built saves and real envelopes. N.js's own text is the truth.
import { afkTarget } from "@/lib/game/afkTarget";
import { MapAFKtarget, MapAFKtargetSide, MapName } from "@/lib/game/data";
import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GOLDEN_SAVES } from "../support/saves";
import { listAt } from "@/lib/game/lists";
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { DNSM_CalcTalentMAP, TalentCalc } from "@/lib/game/njs/TalentCalc";
import { NotPorted } from "@/lib/game/errors";

const MAP = 251; // a plain map: no dungeon (Dungon() is -1), no arena

const states = new Map<string, { ctx: Ctx; chars: number }>();
afterAll(() => states.clear());
function stateOf(path: string) {
  let s = states.get(path);
  if (!s) {
    const save = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope;
    states.set(path, (s = { ctx: makeCtx(buildGameState(save), { player: 0, map: MAP }), chars: save.charNames.length }));
  }
  return s;
}

describe.skipIf(GOLDEN_SAVES.length === 0)("CalcTalentMAP keys, N.js @4467058, on hand-built saves", () => {
  // a fresh envelope per variant (the state is built from a clone): the first real save with its Cards, RoyalG... replaced
  const variant = (edit: (data: Record<string, any>) => void, player = 0) => {
    const save = structuredClone(JSON.parse(readFileSync(GOLDEN_SAVES[0], "utf8"))) as GameEnvelope & { data: Record<string, any> };
    edit(save.data);
    return makeCtx(buildGameState(save), { player, map: MAP });
  };

  // the edit must survive the load steps: a save below CSver 33 gets RoyalG rebuilt (loaderInit), so take the newest save that keeps it
  const keeping = (edit: (data: Record<string, any>) => void) => {
    for (const path of [...GOLDEN_SAVES].reverse()) {
      const save = JSON.parse(readFileSync(path, "utf8")) as GameEnvelope & { data: Record<string, any> };
      edit(save.data);
      const ctx = makeCtx(buildGameState(save), { player: 0, map: MAP });
      if (listAt(ctx, "RoyalG", 0)[0] === save.data.RoyalG[0][0] && listAt(ctx, "Cards", 1).length === save.data.Cards1.length) return ctx;
    }
    throw new Error("no real save keeps the edited RoyalG and Cards");
  };

  it("305: the walk reads Cards[1] at g - DN1, DN1 starting at the Royal Guardian sum (RoyalG[0][0..7]) and growing by one per entry dropped", () => {
    const cards = ["Gem1", "Gem2", "X"];
    const royal = (n: number) => (d: Record<string, any>) => {
      d.Cards1 = [...cards];
      d.RoyalG = [[n, 0, 0, 0, 0, 0, 0, 0], [], []];
    };
    // sum 0: g0 drops Gem1 (DN1 1), g1 reads [0] = Gem2 and drops it, g2 reads X: 1 left
    expect(DNSM_CalcTalentMAP(keeping(royal(0)), "305")).toBe(1);
    // sum 2: g0 and g1 read [-2] and [-1] (undefined, "null"), g2 reads [0] = Gem1: 2 left
    expect(DNSM_CalcTalentMAP(keeping(royal(2)), "305")).toBe(2);
    // "Cards..." entries go too, and only a name that STARTS with Gem or Cards
    expect(DNSM_CalcTalentMAP(keeping((d) => { d.Cards1 = ["CardsX", "aGem", "Gem9"]; d.RoyalG = [[0, 0, 0, 0, 0, 0, 0, 0], [], []]; }), "305")).toBe(1);
  });

  it("656: counts the DreamChallenge entries whose WeeklyBoss d_<n> is exactly -1", () => {
    const done = (ids: number[]) => DNSM_CalcTalentMAP(variant((d) => { d.WeeklyBoss = Object.fromEntries(ids.map((i) => [`d_${i}`, -1])); }), "656");
    expect(done([])).toBe(0);
    expect(done([0, 3, 5])).toBe(3);
    // 1 and 0 are not done; an absent entry is asNumber(null) = 0
    expect(DNSM_CalcTalentMAP(variant((d) => { d.WeeklyBoss = { d_0: 1, d_1: 0, d_4: -1 }; }), "656")).toBe(1);
  });

  it("616: only characters whose class is below 6 count; 620 counts every character", () => {
    // character 0 is a beginner (class 1) at 40, every other one is above class 6 at 300 (class 18, 300 at most: 620 is 300)
    const edit = (d: Record<string, any>) => {
      for (const k of Object.keys(d)) {
        const m = /^CharacterClass_(\d+)$/.exec(k);
        if (!m) continue;
        d[k] = m[1] === "0" ? 1 : 18;
        d[`Lv0_${m[1]}`] = [m[1] === "0" ? 40 : 300, ...d[`Lv0_${m[1]}`].slice(1)];
      }
    };
    expect(DNSM_CalcTalentMAP(variant(edit), "616")).toBe(40);
    expect(DNSM_CalcTalentMAP(variant(edit), "620")).toBe(300);
  });

  it("31: the lowest of Lv0[1..9] (Lv0[0] and the later skills do not count), 1000 at most", () => {
    const lv = (arr: number[]) => (d: Record<string, any>) => { d.Lv0_0 = arr; };
    expect(DNSM_CalcTalentMAP(variant(lv([5, 40, 30, 50, 60, 70, 80, 90, 100, 70, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])), "31")).toBe(30);
    expect(DNSM_CalcTalentMAP(variant(lv([1, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 1])), "31")).toBe(1000);
  });

  it("470 and 485: stamps above 0.5 over the three tabs, vials above level 3 (maps or lists, by their length)", () => {
    const stamps = (d: Record<string, any>) => {
      d.StampLvM = [{ 0: 1, 1: 0.5, 2: 3, length: 3 }, [0, 0.6, 0], { 0: 9, 5: 9, length: 6 }, [9, 9, 9, 9]]; // the 4th tab is not read
    };
    expect(DNSM_CalcTalentMAP(variant(stamps), "470")).toBe(2 + 1 + 2);
    const vials = (d: Record<string, any>) => { d.CauldronInfo[4] = { 0: 4, 1: 3, 2: 5, length: 3 }; };
    expect(DNSM_CalcTalentMAP(variant(vials), "485")).toBe(2);
    expect(DNSM_CalcTalentMAP(variant((d) => { d.CauldronInfo[4] = [4, 3, 3.5, 99]; }), "485")).toBe(3);
  });

  it("an unported key still throws NotPorted", () => {
    expect(() => DNSM_CalcTalentMAP(variant(() => {}), "999")).toThrow(NotPorted);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("TalentCalc(125): the Refinery ranks only while the accuracy is at least 2.25 x the Defence of the AFK target (@4516114)", () => {
  // one real character whose AFK target and Refinery are read; PlayerAccTot is put in the cache, the gate is the only thing that changes
  const gate = (acc: number) => {
    const c = makeCtx(stateOf(GOLDEN_SAVES[0]).ctx.state, { player: 0, map: MAP });
    c.cache.set(`0|${MAP}|PlayerAccTot[]`, acc);
    return TalentCalc(c, 125);
  };
  it("is 0 below the gate and the six ranks Refinery[3..8][1] at or above it", () => {
    const refinery = (JSON.parse(readFileSync(GOLDEN_SAVES[0], "utf8")) as GameEnvelope & { data: Record<string, any> }).data.Refinery as number[][];
    const sum = refinery.slice(3, 9).reduce((a, row) => a + Number(row[1] ?? 0), 0);
    expect(sum).toBeGreaterThan(0);
    expect(gate(0)).toBe(0);
    expect(gate(1e30)).toBe(sum);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("GetBuffBonuses 195, 420, 585, 615: the generic rule, from the save's BuffsActive (@4279371)", () => {
  const withBuff = (id: number | null, talent: number) => {
    const save = structuredClone(JSON.parse(readFileSync(GOLDEN_SAVES[0], "utf8"))) as GameEnvelope & { data: Record<string, any> };
    save.data.BuffsActive_0 = id === null ? [] : [[id, 100, 100]];
    const c = makeCtx(buildGameState(save), { player: 0, map: MAP });
    for (const b of [195, 420, 585]) c.cache.set(`0|${MAP}|GetTalentNumber[1,${b}]`, talent);
    return c;
  };
  it.each([195, 420, 585])("%i is its talent number while it runs, else 0", (id) => {
    expect(GetBuffBonuses(withBuff(id, 7), id, 1)).toBe(7);
    expect(GetBuffBonuses(withBuff(null, 7), id, 1)).toBe(0);
    expect(GetBuffBonuses(withBuff(id === 195 ? 420 : 195, 7), id, 1)).toBe(0);
  });
  it("615 is 1 while it runs (not its talent number), else 0", () => {
    expect(GetBuffBonuses(withBuff(615, 7), 615, 1)).toBe(1);
    expect(GetBuffBonuses(withBuff(null, 7), 615, 1)).toBe(0);
  });
  it("a buff nobody ported still throws NotPorted", () => {
    expect(() => GetBuffBonuses(withBuff(null, 0), 40, 1)).toThrow(NotPorted);
  });
});

describe.skipIf(GOLDEN_SAVES.length === 0)("AFKtarget follows ctx.map through the scene-load rule (Ruling V, N.js @15291900)", () => {
  const at = (map: number, saved: string, savedMap = 5) => {
    const save = JSON.parse(readFileSync(GOLDEN_SAVES[0], "utf8")) as GameEnvelope & { data: Record<string, any> };
    save.data.AFKtarget_0 = saved;
    save.data.CurrentMap_0 = savedMap;
    return afkTarget(makeCtx(buildGameState(save), { player: 0, map }));
  };
  const side = (MapAFKtargetSide as unknown as string[][]).findIndex((l, m) => m > 5 && l.some((x) => x !== "_"));
  it("is the saved target on the saved map", () => expect(at(5, "Whatever", 5)).toBe("Whatever"));
  it("is MapAFKtarget[map] on another map when the target is not a side target", () => expect(at(side, "Whatever")).toBe((MapAFKtarget as unknown as string[])[side]));
  it("is kept on another map when it is a side target of that map", () => {
    const t = (MapAFKtargetSide as unknown as string[][])[side].find((x) => x !== "_")!;
    expect(at(side, t)).toBe(t);
  });
  it("keeps Cooking only in xSpaceaaTown, and plank replaces the target in ForestBOSS", () => {
    const names = (MapName as unknown as string[]);
    const town = names.indexOf("xSpaceaaTown");
    const boss = names.indexOf("ForestBOSS");
    expect(at(town, "Cooking")).toBe("Cooking");
    expect(at(side, "Cooking")).not.toBe("Cooking");
    if (boss >= 0) expect(at(boss, "Whatever")).toBe("plank");
  });
});
