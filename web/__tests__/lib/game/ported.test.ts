// The PORTED declarations (lib/game/ported.ts) are what the inventory marks `[x]` from. This keeps them honest in both directions,
// by calling each module with a permissive ctx: every save read succeeds (the mocked `attr` answers an array of arrays that reads as 1),
// so a NotPorted guard that sits after a read is still reached. A declared sub-case or index must not throw NotPorted; an undeclared
// sub-case, or an undeclared index inside a declared list, must.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import type { Ctx } from "@/lib/game/ctx";
import { NotPorted } from "@/lib/game/errors";
import type { Ported } from "@/lib/game/ported";
import { isPorted } from "@/scripts/njs-closure";

vi.mock("@/lib/game/attr", async (orig) => {
  const real = await orig<typeof import("@/lib/game/attr")>();
  const U: any = new Proxy([], {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 1;
      if (k === "length") return 8;
      if (k === "toString" || k === "join") return () => "1"; // the default would print the array into itself, forever
      if (typeof k === "symbol" || k in Array.prototype) return Reflect.get(t, k);
      return U;
    },
    has: () => true,
  });
  return { ...real, attr: () => U, asNum: () => 1, asNumber: (v: unknown) => (typeof v === "number" ? v : 1) };
});

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 }); // the first import of a module loads its game data

const ctx = (): Ctx => ({ state: {} as never, player: 0, map: 0, cache: new Map(), trace: null });
const notPorted = (fn: (c: Ctx, ...a: any[]) => number, args: (string | number)[]): boolean => {
  try {
    fn(ctx(), ...args);
  } catch (e) {
    return e instanceof NotPorted;
  }
  return false;
};

const GENERIC: Record<string, (string | number)[]> = {
  ArcadeBonus: [0], Companions: [0], AchieveStatus: [0], CompLV2: [44], getLOG: [10], GetBribeBonus: ["30"], chipBonuses: ["dmg"],
  ArbitraryCode5Inputs: ["x", 0, 0, 0, 0, 0], Dungon: [], GetTalentNumber: [1, 10], getbonus2: [1, 51, -1], FamilyBonsuesREAL: [7, 0, 100],
  EtcBonuses: ["46"], CardBonusREAL: [9], StampBonusOfTypeX: ["BaseSTR"], MealBonus: ["Stat"], GuildBonuses: [1], PlayerMPmax: [], PlayerHPmax: [], CardSetBonuses: [0, "1"], FoodBonuses: ["HealthEffectBonus"], TotalFoodBonuses: ["HpBaseBoosts"], Shrine: [1], GoldFoodBonuses: ["AllStatz"],
};
// the argument list of a call to `name` with index `idx` and `e`; most modules are (sub, b, e), GetSetBonus (set, what, e, f), Breeding (sub, string b, e, f)
const call = (fn: string, name: string, idx: number | string | undefined, e = 0): (string | number)[] =>
  fn === "GetSetBonus" ? ["LUSTRE_SET", name, e, 0] : fn === "Breeding" ? [name, idx ?? "0", e, 0] : [name, idx ?? 0, e];

const names = readdirSync("lib/game/njs").map((f) => f.replace(/\.ts$/, ""));
const load = (n: string) => import(`@/lib/game/njs/${n}`) as Promise<{ PORTED?: Ported } & Record<string, any>>;

describe("PORTED declarations", () => {
  it("exist for the modules the Damage inventory reaches", async () => {
    let n = 0;
    for (const name of names) if ((await load(name)).PORTED) n++; // one at a time: all at once crashes the worker
    expect(n).toBeGreaterThanOrEqual(29);
  });

  for (const name of names) {
    it(`${name}: what it declares does not throw NotPorted, what it does not declare does`, async () => {
      const m = await load(name);
      const p = m.PORTED;
      if (!p) return;
      const fn = m[name] as (c: Ctx, ...a: any[]) => number;
      if (p === "generic") return expect(notPorted(fn, GENERIC[name])).toBe(false);
      if (Array.isArray(p)) {
        for (const i of p) expect(notPorted(fn, [i]), `${name}(${i}) declared`).toBe(false);
        for (let i = 0; i <= Math.max(...p); i++) if (!p.includes(i)) expect(notPorted(fn, [i]), `${name}(${i}) undeclared`).toBe(true);
        return;
      }
      const rec = p as Record<string, true | readonly (number | string)[]>;
      expect(notPorted(fn, call(name, "__undeclared__", 0)), `${name} sub-case __undeclared__`).toBe(true);
      for (const [key, entry] of Object.entries(rec)) {
        const [sub, e] = key.endsWith("@e2") ? [key.slice(0, -3), 2] : [key, 0];
        if (entry === true) {
          expect(notPorted(fn, call(name, sub, undefined, e)), `${name}.${key}`).toBe(false);
          continue;
        }
        for (const i of entry) expect(notPorted(fn, call(name, sub, i, e)), `${name}.${key}[${i}] declared`).toBe(false);
        const nums = entry.filter((x): x is number => typeof x === "number");
        for (let i = 0; i <= Math.max(-1, ...nums); i++) {
          if (nums.length && !entry.includes(i)) expect(notPorted(fn, call(name, sub, i, e)), `${name}.${key}[${i}] undeclared`).toBe(true);
        }
        if (!nums.length) expect(notPorted(fn, call(name, sub, "__other__", e)), `${name}.${key}["__other__"]`).toBe(true);
      }
    });
  }
});

describe("isPorted (the marker)", () => {
  let holes: Ported, setBonus: Ported, research: Ported;
  beforeAll(async () => {
    [holes, setBonus, research] = (await Promise.all(["Holes", "GetSetBonus", "ResearchStuff"].map(load))).map((m) => m.PORTED!);
  });
  it("marks only Holes B_UPG 55, not the six rows a read-error probe once marked", () => {
    expect(isPorted({ args: ["B_UPG", 55, 0] }, holes)).toBe(true);
    for (const b of [57, 84, 49, 50, 79, 98]) expect(isPorted({ args: ["B_UPG", b, 0] }, holes), `B_UPG ${b}`).toBe(false);
  });

  it("the committed inventory has none of those six rows ticked (open, or [~] when proven unreachable)", () => {
    const md = readFileSync("../docs/superpowers/plans/2026-11-04-damage-inventory.md", "utf8");
    for (const b of [57, 84, 49, 50, 79, 98]) expect(["[ ]", "[~]"].some((m) => md.includes(`- ${m} Holes("B_UPG",${b},`)), `B_UPG ${b}`).toBe(true);
  });

  it("reads GetSetBonus's name from the second argument, Grid_Bonus's e=2 rule, and an unknown index as not covered", () => {
    expect(isPorted({ args: ["LUSTRE_SET", "Bonus", 0, 0] }, setBonus)).toBe(true);
    expect(isPorted({ args: ["Grid_Bonus", 127, 0] }, research)).toBe(true);
    expect(isPorted({ args: ["Grid_Bonus", 127, 2] }, research)).toBe(false);
    expect(isPorted({ args: ["Grid_Bonus", 68, 2] }, research)).toBe(true);
    expect(isPorted({ args: ["Grid_Bonus"] }, research)).toBe(false);
    expect(isPorted({ args: ["B_UPG"] }, holes)).toBe(false);
    expect(isPorted({ args: [14] }, undefined)).toBe(false);
  });
});
