// Task 3 (Multikill plan): the edges of WorkbenchStuff("MultiKillTOTAL") (N.js @7810403 raw) and its two halves, MultiKill_base (@7808345) and MultiKill_perTier (@7805748), on a
// synthetic envelope (no real save, so CI runs them): every term alone at a value of its own, so a swapped key or a wrong multiplier fails; both halves' soft cap just under and at
// every edge; the Cove; the Death Note world of ctx.map at 49/50 and 299/300; the per-tier bypass; the tier at the ceiling and on a map whose target has no monster. Every block the
// sub-cases call answers 0 unless the test seeds it (expStub's ZeroCache); `real` lists the blocks left to their code.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { njsFunction, njsNamedBlocks } from "@/lib/diagnose/njsCalls";
import { MONSTERS } from "@/lib/game/data";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";
import { loadNjs } from "@/scripts/njs-calls";
import { type Data, type Seeds, synth } from "../support/expStub";

const REAL = ['WorkbenchStuff["MultiKill'];
const TIER = 'RunCodeOfTypeXforThingY["OverkillStuffs","2"]';
type Opts = { map?: number; real?: string[] };
const ctxOf = (data: Data, seeds: Seeds, o: Opts) => synth({ Tower: [0, 0, 0], ...data }, { map: o.map, seeds, real: [...REAL, ...(o.real ?? [])] });
const total = (data: Data = {}, seeds: Seeds = {}, o: Opts = {}) => WorkbenchStuff(ctxOf(data, seeds, o), "MultiKillTOTAL", 0, 0);
const base = (data: Data = {}, seeds: Seeds = {}, o: Opts = {}) => WorkbenchStuff(ctxOf(data, seeds, o), "MultiKill_base", 0, 0);
const perTier = (data: Data = {}, seeds: Seeds = {}, o: Opts = {}) => WorkbenchStuff(ctxOf(data, seeds, o), "MultiKill_perTier", 0, 0);
const ola = (at: Record<number, number>) => ({ OptLacc: Object.assign(Array<number>(700).fill(0), at) });
const close = (got: number, want: number) => expect(got).toBeCloseTo(want, 10);

/** Each term of MultiKill_base alone: [key, seed, its points]. */
const BASE_TERMS: [string, number, number][] = [
  ['DNSM.StarSigns["MultiKill"]', 1.5, 1.5],
  ["SaltLick[8]", 2.25, 2.25],
  ['StampBonusOfTypeX["Overkill"]', 3.25, 3.25],
  ['EtcBonuses["29"]', 4.75, 4.75],
  ["AchieveStatus[148]", 3.5, 3.5],
  ["AchieveStatus[122]", 1, 6], // 6 x
  ["AchieveStatus[123]", 1, 2], // 2 x
];
/** Each term of MultiKill_perTier alone, on map 251: [key, seed]. */
const PER_TIER_TERMS: [string, number][] = [
  ['WorkbenchStuff["OverkillQTY",5,0]', 1.5], // floor(251 / 50)
  ['WorkbenchStuff["OverkillQTY",7,0]', 2.5],
  ['DNSM.AlchVials["Overkill"]', 3.5],
  ["GetBuffBonuses[46,2]", 4.5],
  ["ArcadeBonus[8]", 5.5],
  ['Sailing["ArtifactBonus",26,0]', 6.5],
  ["GetBuffBonuses[469,2]", 7.5],
  ['chipBonuses["mkill"]', 8.5],
  ['EtcBonuses["71"]', 9.5],
  ['Holes["MeasurementBonusTOTAL",9,0]', 10.5],
  ["CardBonusREAL[80]", 11.5],
  ['DNSM.StarSigns["78"]', 12.5],
  ["prayersReal[16,0]", 13.5],
  ['Breeding["ShinyBonusS","Nah",4,-1]', 14.5],
  ['DNSM.BoxRewards["13b"]', 15.5],
  ['DNSM.AlchBubbles["MKtierACTIVE"]', 16.5],
  ['CardSetBonuses[0,"11"]', 17.5],
];
const STATUE = 'ArbitraryCode["StatueOnyxOwned"]';
const T654 = "GetTalentNumber[1,654]";
const T58 = "getbonus2[1,58,-1]";

describe("MultiKillTOTAL: floor(base + tier x perTier)", () => {
  it("is 0 with every block 0", () => expect(total()).toBe(0));
  it("floors the sum (it does not round), after the tier multiplies", () => {
    expect(total({}, { "SaltLick[8]": 2.9 })).toBe(2);
    expect(total({}, { "SaltLick[8]": 2.5, [TIER]: 3, "ArcadeBonus[8]": 1.25 })).toBe(6); // 2.5 + 3 x 1.25 = 6.25
    expect(total({}, { [TIER]: 3 })).toBe(0); // a tier with nothing to multiply
  });
  it("the base is not multiplied by the tier", () => expect(total({}, { "SaltLick[8]": 7, [TIER]: 5 })).toBe(7));
});

describe("MultiKill_base: every term alone", () => {
  it.each(BASE_TERMS)("%s at %s is %s", (key, seed, points) => close(base({}, { [key]: seed }), points));
  it("the Death Note building: 2 x asNumber(TowerInfo[2])", () => {
    expect(base({ Tower: [0, 0, 4] })).toBe(8);
    expect(base({ Tower: [0, 0, "4"] })).toBe(8);
    expect(base({ Tower: [4, 4, 0, 4] })).toBe(0); // another tower is not this one
  });
  it("achievement 148 stops at 5", () => {
    close(base({}, { "AchieveStatus[148]": 4.9 }), 4.9);
    expect(base({}, { "AchieveStatus[148]": 5 })).toBe(5);
    expect(base({}, { "AchieveStatus[148]": 5.1 })).toBe(5);
  });
  it("Onyx statues x talent 654, and neither alone moves it", () => {
    expect(base({}, { [STATUE]: 7, [T654]: 1.5 })).toBe(10.5);
    expect(base({}, { [STATUE]: 7 })).toBe(0);
    expect(base({}, { [T654]: 1.5 })).toBe(0);
  });
  it("they add", () => {
    const seeds: Seeds = Object.fromEntries(BASE_TERMS.map(([k, v]) => [k, v]));
    close(base({ Tower: [0, 0, 4] }, { ...seeds, [STATUE]: 7, [T654]: 1.5 }), BASE_TERMS.reduce((s, [, , p]) => s + p, 0) + 8 + 10.5);
  });
});

describe("MultiKill_perTier: every term alone", () => {
  it.each(PER_TIER_TERMS)("%s at %s", (key, seed) => close(perTier({}, { [key]: seed }), seed));
  it("talent 58: getbonus2 x floor(OptionsListAccount[158] / 5), and neither alone moves it", () => {
    expect(perTier(ola({ 158: 14 }), { [T58]: 1.5 })).toBe(3);
    expect(perTier(ola({ 158: 15 }), { [T58]: 1.5 })).toBe(4.5);
    expect(perTier(ola({ 158: 15 }))).toBe(0);
    expect(perTier({}, { [T58]: 1.5 })).toBe(0);
  });
  it("they add", () => {
    const seeds: Seeds = Object.fromEntries(PER_TIER_TERMS);
    close(perTier(ola({ 158: 15 }), { ...seeds, [T58]: 1.5 }), PER_TIER_TERMS.reduce((s, [, v]) => s + v, 0) + 4.5);
  });
});

describe("the Death Note world: page floor(ctx.map / 50) of OverkillQTY, the mini page 7 besides it", () => {
  const page = (p: number) => `WorkbenchStuff["OverkillQTY",${p},0]`;
  const seeds: Seeds = { [page(0)]: 3, [page(1)]: 5, [page(5)]: 7, [page(6)]: 11, [page(7)]: 1 };
  it.each([
    [49, 4],
    [50, 6],
    [299, 8],
    [300, 12], // under the soft cap's first edge
  ])("map %s", (map, want) => expect(perTier({}, seeds, { map })).toBe(want));
});

describe("the soft cap of each half, from map 300 on", () => {
  /** Just under and at every edge: [sum, what it becomes]. */
  const BRACKETS: [number, number][] = [
    [19.99, 19.99],
    [20, 20],
    [49.99, 20 + 29.99 / 1.1],
    [50, 47.3],
    [99.99, 47.3 + 49.99 / 1.5],
    [100, 80.6],
    [149.99, 80.6 + 49.99 / 5],
    [150, 90.6],
    [199.99, 90.6 + 49.99 / 10],
    [200, 95.6],
    [249.99, 95.6 + 49.99 / 20],
    [250, 98.14],
    [300, 99.14],
  ];
  const B = "SaltLick[8]";
  const P = "ArcadeBonus[8]";
  it.each(BRACKETS)("the base at %s becomes %s", (sum, want) => close(base({}, { [B]: sum }, { map: 300 }), want));
  it.each(BRACKETS)("the per-tier at %s becomes %s", (sum, want) => close(perTier({}, { [P]: sum }, { map: 300 }), want));
  it("map 299 has none", () => {
    expect(base({}, { [B]: 250 }, { map: 299 })).toBe(250);
    expect(perTier({}, { [P]: 250 }, { map: 299 })).toBe(250);
  });
  it("the tier multiplies the capped sum", () => expect(total({}, { [B]: 250, [P]: 250, [TIER]: 3 }, { map: 300 })).toBe(Math.floor(98.14 + 3 * 98.14)));
  it("e = 8675309 skips the per-tier's cap only (the W7 notice's raw sum): not the Cove, not the base's", () => {
    const at = (fn: string, map: number, data: Data = {}) => WorkbenchStuff(ctxOf(data, { [B]: 250, [P]: 250, 'Holes2["Cglunko_MKtier",0,0]': 44 }, { map }), fn, 0, 8675309);
    expect(at("MultiKill_perTier", 300)).toBe(250);
    expect(at("MultiKill_perTier", 216, { Holes: [[17]] })).toBe(44);
    expect(at("MultiKill_base", 300)).toBe(98.14);
  });
});

describe("the Crystal Glunko Cove: map 216 in cavern 17 replaces each sum", () => {
  const COVE: Seeds = { 'Holes2["Cglunko_MKbase",0,0]': 33, 'Holes2["Cglunko_MKtier",0,0]': 44, "SaltLick[8]": 1000, "ArcadeBonus[8]": 1000, [TIER]: 2 };
  it("map 216, cavern 17", () => {
    expect(base({ Holes: [[17]] }, COVE, { map: 216 })).toBe(33);
    expect(perTier({ Holes: [[17]] }, COVE, { map: 216 })).toBe(44);
    expect(total({ Holes: [[17]] }, COVE, { map: 216 })).toBe(33 + 2 * 44);
  });
  it("the cavern is compared loosely (`17 == Holes[0][char]`)", () => expect(base({ Holes: [["17"]] }, COVE, { map: 216 })).toBe(33));
  it("another cavern, or another map, leaves the sums", () => {
    expect(base({ Holes: [[16]] }, COVE, { map: 216 })).toBe(1000);
    expect(perTier({ Holes: [[16]] }, COVE, { map: 216 })).toBe(1000);
    expect(base({ Holes: [[17]] }, COVE, { map: 215 })).toBe(1000);
    expect(perTier({ Holes: [[17]] }, COVE, { map: 217 })).toBe(1000);
  });
  it("it reads the current character's cavern", () => {
    const c = synth({ Tower: [0, 0, 0], Holes: [[16, 17]] }, { map: 216, chars: 2, player: 1, seeds: COVE, real: REAL });
    expect(WorkbenchStuff(c, "MultiKill_base", 0, 0)).toBe(33);
  });
  it("off map 216 it reads no cavern at all (a save with no Holes computes)", () => expect(base({ Holes: undefined }, COVE, { map: 251 })).toBe(1000));
});

describe('the tier: OverkillStuffs("2") on ctx.map\'s target (E = 2 under map 300, 5 from it)', () => {
  const OVERKILL = ['RunCodeOfTypeXforThingY["OverkillStuffs"'];
  const tgt = "mushG";
  const hp = Number((MONSTERS as unknown as Record<string, { MonsterHPTotal: unknown }>)[tgt].MonsterHPTotal);
  const at = (map: number, max: number) => total({ CurrentMap_0: map, AFKtarget_0: tgt }, { "ArcadeBonus[8]": 1, 'DamageDealed["Max"]': max }, { map, real: OVERKILL });
  it("under map 300: tier 1 below HP x 2^2, tier 2 from it", () => {
    expect(at(299, hp * 4 - 1)).toBe(1);
    expect(at(299, hp * 4)).toBe(2);
  });
  it("from map 300: the same damage is tier 1, tier 2 takes HP x 5^2", () => {
    expect(at(300, hp * 4)).toBe(1);
    expect(at(300, hp * 25)).toBe(2);
  });
  it("the tier stops at 51", () => expect(at(299, Number.MAX_VALUE)).toBe(51));
  it("on a map whose target has no monster the game throws, so the block refuses", () => {
    expect(() => total({}, { 'DamageDealed["Max"]': 1e9 }, { map: 33, real: OVERKILL })).toThrow('AFKtarget: expected a MonsterDefinitions key, got string "Z"');
  });
});

// The port is the game's text with the calls spelled the way lib/game spells them: same terms, same order, same parentheses, so the floats are the game's. N.js keeps each half in a
// DNSM field and rereads it: here that field is the local `f`, so the writes and the rereads are the only other tokens the comparison drops.
describe("the expression is N.js's token for token (calls and reads spelled as lib/game spells them)", () => {
  const DNSM_ = 'a.engine.getGameAttribute("DNSM")';
  const spell = (raw: string) =>
    raw
      .replace(/\s+/g, "")
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("DNSM"\)\.h\.MKtzioDN2?\)/g, "f")
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("DNSM"\)\.h\.StarSigns\.h(?:\.(\w+)|\["(\w+)"\])\)/g, (_, a, b) => `DNSM_StarSigns(ctx,"${a ?? b}")`)
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("DNSM"\)\.h\.AlchVials\.h\.(\w+)\)/g, 'DNSM_AlchVials(ctx,"$1")')
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("DNSM"\)\.h\.AlchBubbles\.h\.(\w+)\)/g, 'DNSM_AlchBubbles(ctx,"$1")')
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("DNSM"\)\.h\.BoxRewards\.h\["(\w+)"\]\)/g, 'DNSM_BoxRewards(ctx,"$1")')
      .replace(/c\.asNumber\(a\.engine\.getGameAttribute\("(TowerInfo|OptionsListAccount)"\)\[(\d+)\]\)/g, 'asNum(ctx,"$1",$2)')
      .replace('a.engine.getGameAttribute("Holes")[0][a.engine.getGameAttribute("GetPlayersUsernames").indexOf(a.engine.getGameAttribute("UserInfo")[0])]', 'attr(ctx,"Holes",0,ctx.player)')
      .replace(/a\.engine\.getGameAttribute\("CurrentMap"\)/g, "ctx.map")
      .replace(/\b\w\._customBlock_(\w+)\(/g, "$1(ctx,")
      .replaceAll(`(d=${DNSM_},`, "(")
      .replace(/,d\.h\.MKtzioDN2?=f\)/g, ")")
      .replace(/(?<![\w.])\.(\d)/g, "0.$1");
  const src = () => readFileSync("lib/game/njs/WorkbenchStuff.ts", "utf8").replace(/\r/g, "");
  /** The body of `function <name>` in the port, no whitespace. */
  const portOf = (name: string) => {
    const s = src();
    const from = s.indexOf("{", s.indexOf(`function ${name}(`)) + 1;
    return s.slice(from, s.indexOf("\n}", from)).replace(/\s+/g, "");
  };
  const raw = (name: string) => njsNamedBlocks(njsFunction(loadNjs(), "WorkbenchStuff")!.body, name)[0];
  const noNjs = !existsSync("scripts/updater/.cache/N.new.js");

  it.skipIf(noNjs)("MultiKillTOTAL", () => {
    const s = src();
    const at = s.indexOf('case "MultiKillTOTAL":') + 'case "MultiKillTOTAL":'.length;
    expect(s.slice(at, s.indexOf(";", at) + 1).replace(/\s+/g, "")).toBe(spell(raw("MultiKillTOTAL")));
  }, 120_000);

  it.skipIf(noNjs)("MultiKill_base", () => {
    const njs = spell(raw("MultiKill_base"))
      .replace(`returnd=${DNSM_},f=`, "letf=")
      .replace(",d.h.MKtzioDN2=f,", ";") // the write after the sum
      .replace("),216==ctx.map", ");216==ctx.map")
      .replace(`,${DNSM_}.h.MKtzioDN2;`, ";returnf;");
    expect(portOf("multiKillBase")).toBe(njs);
  }, 120_000);

  it.skipIf(noNjs)("MultiKill_perTier", () => {
    const njs = spell(raw("MultiKill_perTier"))
      .replace(`{d=${DNSM_};varf=`, "letf=")
      .replace(";d.h.MKtzioDN=f;", ";")
      .replace(`return${DNSM_}.h.MKtzioDN}`, "returnf;");
    expect(portOf("multiKillPerTier")).toBe(njs);
  }, 120_000);
});
