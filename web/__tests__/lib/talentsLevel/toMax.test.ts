// To Max and Unbooked on a synthetic save: SL / SM / SLpre are the only inputs the scans read besides the account's Max Book Lv Cap.
import { describe, expect, it, vi } from "vitest";

// the account's cap is tested in dropRate/explain/talent.test.ts; here it is a given
vi.mock("@/lib/dropRate/explain/talent", () => ({ maxBookLv: () => 434 }));
import { computeTalentsToMax } from "@/lib/talentsLevel/toMax";
import { computeUnbooked } from "@/lib/talentsLevel/unbooked";
import { hasTalentCapBoosters } from "@/lib/talentsLevel/capBoosters";
import { TALENT_TABS_BY_CLASS } from "@/lib/talentsLevel/talentTabs.gen";
import { getCharClassKey } from "@/lib/talentsLevel/charClass";

const CLASS = 7; // any class with regular tabs
const classKey = getCharClassKey({ data: { CharacterClass_0: CLASS } }, 0)!;
const tabs = TALENT_TABS_BY_CLASS[classKey].tabs;
const regular = tabs.filter((t) => !t.name.startsWith("Special Talent")).flatMap((t) => t.talents.map((x) => x.id));
const star = tabs.filter((t) => t.name.startsWith("Special Talent")).flatMap((t) => t.talents.map((x) => x.id));
const [a, b] = regular.filter((id) => !hasTalentCapBoosters(id));
const booster = regular.find((id) => hasTalentCapBoosters(id));

const save = (o: { sl?: object; slpre?: object; sm?: object; active?: 0 | 1 }) => ({
  charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
  data: {
    CharacterClass_0: CLASS, PVStatList_0: Array(12).fill(0), Lv0_0: [100, 0], PlayerStuff_0: [0, o.active ?? 0],
    SL_0: o.sl ?? {}, ...(o.slpre ? { SLpre_0: o.slpre } : {}), ...(o.sm ? { SM_0: o.sm } : {}),
    Atoms: Array(8).fill(0), SaltLick: Array(6).fill(0), Sailing: [[], [], [], Array(40).fill(0)], Summon: [[], []],
    GemItemsPurchased: Array(20).fill(0), Spelunk: Array.from({ length: 60 }, () => [] as number[]), Dream: Array(20).fill(0), AchieveReg: [],
  },
});
const cap = (_s: unknown) => 434;

describe("computeTalentsToMax", () => {
  it("lists a talent below its saved cap in one preset only, and skips star tabs", () => {
    const s = save({ sl: { [a]: 50, [b]: 90 }, slpre: { [a]: 50, [b]: 90 }, sm: { [a]: 50, [b]: 90, [star[0]]: 5 } });
    s.data.SL_0 = { [a]: 50, [b]: 40 };
    const g = computeTalentsToMax(s)[0];
    const mine = g.items.filter((i) => i.talentId === a || i.talentId === b);
    expect(mine.map((i) => i.talentId)).toEqual([b]);
    expect(mine[0]).toMatchObject({ cap: 90, investedP1: 40, investedP2: 90 });
    expect(g.items.some((i) => star.includes(i.talentId))).toBe(false);
  });
  it("with preset 2 active, investedP1 and investedP2 swap", () => {
    const base = { sl: { [b]: 40 }, slpre: { [b]: 90 }, sm: { [b]: 90 } };
    const p1 = computeTalentsToMax(save({ ...base, active: 0 }))[0].items.find((i) => i.talentId === b)!;
    const p2 = computeTalentsToMax(save({ ...base, active: 1 }))[0].items.find((i) => i.talentId === b)!;
    expect(p1).toMatchObject({ investedP1: 40, investedP2: 90 });
    expect(p2).toMatchObject({ investedP1: 90, investedP2: 40 });
  });
  it("falls back to maxBookLv when SM is 0 or absent", () => {
    const s = save({ sl: { [a]: 1 }, sm: { [a]: 0 } });
    const it = computeTalentsToMax(s)[0].items.find((i) => i.talentId === a)!;
    expect(it.cap).toBe(cap(s));
  });
});

describe("computeUnbooked", () => {
  it("lists a cap below maxBookLv, leaves out cap boosters and caps of 0", () => {
    const s = save({ sm: { [a]: 10, [b]: 0, ...(booster ? { [booster]: 10 } : {}) } });
    const items = computeUnbooked(s)[0].items;
    expect(items.map((i) => i.talentId)).toEqual([a]);
    expect(items[0]).toMatchObject({ currentCap: 10, maxCap: cap(s), booksNeeded: cap(s) - 10 });
  });
});
