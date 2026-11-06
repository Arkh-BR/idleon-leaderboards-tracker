import { beforeAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { callDiff, njsCalls, njsFunction, njsNamedBlock, njsNamedBlocks, njsNumericBranch, njsPrelude, njsSlice, traceCalls } from "@/lib/diagnose/njsCalls";
import type { TraceNode } from "@/lib/game/trace";
import { normalizeBundle } from "@/scripts/updater/extract";

const node = (block: string, args: unknown[] = [], children: TraceNode[] = [], note?: string): TraceNode => ({
  block,
  args,
  value: 0,
  children,
  ...(note ? { note } : {}),
});
const root = (...children: TraceNode[]) => node("(root)", [], children);

describe("njsCalls", () => {
  it("reads a _customBlock_ call with its first literal argument, in source order", () => {
    const body = `"VaultUpgBonus"==d?m._customBlock_Summoning("VaultUpgBonus",20,0)*x._customBlock_TotalStats("STR"):0`;
    expect(njsCalls(body)).toEqual([
      { block: "Summoning", arg0: "VaultUpgBonus", args: ["VaultUpgBonus", 20, 0] },
      { block: "TotalStats", arg0: "STR", args: ["STR"] },
    ]);
  });

  it("reads a bare k.GetTalentNumber(1,95) and its _customBlock_ spelling as the same call, with a numeric arg0", () => {
    expect(njsCalls("k.GetTalentNumber(1,95)")).toEqual([{ block: "GetTalentNumber", arg0: 1, args: [1, 95] }]);
    expect(njsCalls("k._customBlock_GetTalentNumber(1,95)")).toEqual([{ block: "GetTalentNumber", arg0: 1, args: [1, 95] }]);
  });

  it("has no arg0 when the first argument is not a lone literal, and still finds calls nested in it", () => {
    const calls = njsCalls(`x._customBlock_TotalStats(""+h.string(f.h[v][0]))+k._customBlock_Foo(1+n)+k._customBlock_Bar()`);
    expect(calls).toStrictEqual([{ block: "TotalStats" }, { block: "Foo" }, { block: "Bar" }]);
    expect(njsCalls(`m._customBlock_A(m._customBlock_B("s"),2)`)).toEqual([{ block: "A" }, { block: "B", arg0: "s", args: ["s"] }]);
  });

  it("carries the literal arguments up to the first non-literal one, arg0 being the first", () => {
    expect(njsCalls(`m._customBlock_Summoning("VaultUpgBonus",63,0)`)).toEqual([
      { block: "Summoning", arg0: "VaultUpgBonus", args: ["VaultUpgBonus", 63, 0] },
    ]);
    expect(njsCalls(`m._customBlock_Sailing("ArtifactBonus",b,0)+k.GetTalentNumber(1,-2.5,"a,b",f.x,7)`)).toEqual([
      { block: "Sailing", arg0: "ArtifactBonus", args: ["ArtifactBonus"] },
      { block: "GetTalentNumber", arg0: 1, args: [1, -2.5, "a,b"] },
    ]);
    expect(njsCalls(`m._customBlock_A(1+n,2)`)).toStrictEqual([{ block: "A" }]); // not a lone literal: no args at all
  });

  it("reads negative and decimal numbers, and an empty string", () => {
    expect(njsCalls(`k._customBlock_A(-1,0)+k._customBlock_B(.5)+k._customBlock_C(2.25)+k._customBlock_D("")`)).toEqual([
      { block: "A", arg0: -1, args: [-1, 0] },
      { block: "B", arg0: 0.5, args: [0.5] },
      { block: "C", arg0: 2.25, args: [2.25] },
      { block: "D", arg0: "", args: [""] },
    ]);
  });

  it("ignores engine helpers, attribute reads and the definition itself", () => {
    const body = `x._customBlock_Foo=function(d,b){return c.asNumber(a.engine.getGameAttribute("Lv")[0])+h.string(d)+Math.floor(b)}`;
    expect(njsCalls(body)).toEqual([]);
  });
});

describe("traceCalls", () => {
  it("lists every call under the root in call order, nested ones after their parent, a cached leaf included", () => {
    const trace = root(
      node("TotalStats", ["STR"], [node("Stamp", [4, 2]), node("Stamp", [4, 2], [], "cached")]),
      node("Summoning", ["VaultUpgBonus", 20, 0])
    );
    expect(traceCalls(trace)).toEqual([
      { block: "TotalStats", arg0: "STR" },
      { block: "Stamp", arg0: 4 },
      { block: "Stamp", arg0: 4 },
      { block: "Summoning", arg0: "VaultUpgBonus" },
    ]);
  });

  it("has no arg0 when the first argument is absent or not a string or number", () => {
    expect(traceCalls(root(node("A"), node("B", [{ x: 1 }]), node("C", [undefined])))).toStrictEqual([
      { block: "A" },
      { block: "B" },
      { block: "C" },
    ]);
  });

  it("skips Runtime values (not N.js calls, and one named after a block would mask a missing call), keeps cached and threw nodes", () => {
    const trace = root(
      node("TotalStats", ["STR"], [], "runtime: not in the save"),
      node("Stamp", [4], [], "cached"),
      node("Summoning", ["V"], [node("Inner", [1])], "threw: boom")
    );
    expect(traceCalls(trace)).toEqual([{ block: "Stamp", arg0: 4 }, { block: "Summoning", arg0: "V" }, { block: "Inner", arg0: 1 }]);
    // so a Runtime stand-in for TotalStats does not cover the game's TotalStats call
    expect(callDiff([{ block: "TotalStats" }], traceCalls(trace)).missing).toEqual([{ block: "TotalStats" }]);
  });

  it("skips assumed values like runtime ones: not N.js calls, and one named after a block would mask a missing call", () => {
    const trace = root(
      node("TotalStats", ["STR"], [], "assumed: the lab is connected"),
      node("Summoning", ["V"], [node("Inner", [1]), node("GenINFO", [], [], "assumed: x")]),
      node("Stamp", [4], [], "cached")
    );
    expect(traceCalls(trace)).toEqual([{ block: "Summoning", arg0: "V" }, { block: "Inner", arg0: 1 }, { block: "Stamp", arg0: 4 }]);
    expect(callDiff([{ block: "TotalStats" }], traceCalls(trace)).missing).toEqual([{ block: "TotalStats" }]);
  });

  it("skips (absent) leaves, an asNumber(null) = 0 that is not an N.js call, but keeps the calls around them", () => {
    const trace = root(
      node("Summoning", ["V", 20, 0], [node("(absent)", ["Lv0[9]"], [], "absent: asNumber(null) = 0"), node("Stamp", [4])]),
      node("(absent)", ["OptionsListAccount[7]"], [], "absent: asNumber(null) = 0")
    );
    expect(traceCalls(trace)).toEqual([{ block: "Summoning", arg0: "V" }, { block: "Stamp", arg0: 4 }]);
  });
});

describe("callDiff", () => {
  it("reports a missing TotalStats when the trace lacks it", () => {
    const expected = njsCalls(`x._customBlock_ReturnClasses(n)[0]*x._customBlock_TotalStats(""+h.string(s))`);
    const actual = traceCalls(root(node("ReturnClasses", [])));
    expect(callDiff(expected, actual)).toEqual({ missing: [{ block: "TotalStats" }], extra: [] });
  });

  it("reports what only we call as extra", () => {
    expect(callDiff([{ block: "A" }], [{ block: "A" }, { block: "Z", arg0: 3 }])).toEqual({
      missing: [],
      extra: [{ block: "Z", arg0: 3 }],
    });
  });

  it("matches a literal arg0 exactly, and any arg0 against a game call whose argument is not a literal", () => {
    // game: TotalStats(<expr>) is covered by TotalStats("STR"); Summoning("VaultUpgBonus") is not covered by Summoning("Other")
    const expected = [{ block: "TotalStats" }, { block: "Summoning", arg0: "VaultUpgBonus" }];
    const actual = [{ block: "TotalStats", arg0: "STR" }, { block: "Summoning", arg0: "Other" }];
    expect(callDiff(expected, actual)).toEqual({
      missing: [{ block: "Summoning", arg0: "VaultUpgBonus" }],
      extra: [{ block: "Summoning", arg0: "Other" }],
    });
  });

  it("lists each distinct call once, however many sites make it", () => {
    const a = { block: "Stamp", arg0: 4 };
    expect(callDiff([a, a, a], [])).toEqual({ missing: [a], extra: [] });
    expect(callDiff([], [a, a])).toEqual({ missing: [], extra: [a] });
  });

  it("treats the number 1 and the string '1' as different arguments", () => {
    expect(callDiff([{ block: "A", arg0: 1 }], [{ block: "A", arg0: "1" }])).toEqual({
      missing: [{ block: "A", arg0: 1 }],
      extra: [{ block: "A", arg0: "1" }],
    });
  });
});

describe("njsFunction / njsNamedBlock / njsNumericBranch on a synthetic bundle", () => {
  // Two functions that both hold a named block "Bonus"; the second has a numeric sub-dispatch on b.
  const norm = [
    `m._customBlock_First=function(d,b){if("Bonus"==d){return x._customBlock_Other(1)}return 0};`,
    `m._customBlock_Second=function(d,b,e){if("Bonus"==d){if(7==e)return k._customBlock_One("a");`,
    `for(g=0;g<9;g++){if(25==l)k._customBlock_Loop(g)}`,
    `-1==b&&k._customBlock_Neg();`,
    `2==b&&k._customBlock_Two("t");`,
    `25==b&&(k._customBlock_TwentyFive(3),x._customBlock_TotalStats(""+s));`,
    `30==b&&k._customBlock_Thirty()}return 1};`,
    `m._customBlock_Third=function(d){return k._customBlock_Late()};`,
    `m._customBlock_Second2=function(d){return 9};`,
  ].join("");
  const second = njsFunction(norm, "Second")!;
  const bonus = njsNamedBlock(second.body, "Bonus")!;

  it("finds a function by name, with its parameters and its body braces and all, and not one that merely starts with the same name", () => {
    expect(njsFunction(norm, "First")).toEqual({ params: ["d", "b"], body: `{if("Bonus"==d){return x._customBlock_Other(1)}return 0}` });
    expect(second.params).toEqual(["d", "b", "e"]);
    expect(njsFunction(norm, "Second2")).toEqual({ params: ["d"], body: "{return 9}" });
    expect(njsFunction(norm, "Nope")).toBeUndefined();
  });

  it("takes the last definition of a name defined twice, as the updater does", () => {
    const twice = `x._customBlock_G=function(d){return 1};x._customBlock_G=function(){return 2}`;
    expect(njsFunction(twice, "G")).toEqual({ params: [], body: "{return 2}" });
  });

  it("finds a named block inside the requested function, so a name shared by two functions does not collide", () => {
    expect(njsCalls(njsNamedBlock(njsFunction(norm, "First")!.body, "Bonus")!)).toEqual([{ block: "Other", arg0: 1, args: [1] }]);
    expect(njsCalls(bonus).map((c) => c.block)).toEqual(["One", "Loop", "Neg", "Two", "TwentyFive", "TotalStats", "Thirty"]);
    expect(njsNamedBlock(njsFunction(norm, "Third")!.body, "Bonus")).toBeUndefined();
    expect(njsNamedBlock(second.body, "Missing")).toBeUndefined();
    expect(njsNamedBlock(second.body, "a.*")).toBeUndefined(); // a name, not a pattern
  });

  it("slices a numeric sub-branch from n==v to the next <digits>==v", () => {
    const slice = njsNumericBranch(bonus, 25, second.params)!;
    expect(slice.startsWith("25==b&&")).toBe(true);
    expect(njsCalls(slice)).toEqual([{ block: "TwentyFive", arg0: 3, args: [3] }, { block: "TotalStats" }]);
    expect(njsCalls(njsNumericBranch(bonus, 2, second.params)!)).toEqual([{ block: "Two", arg0: "t", args: ["t"] }]);
  });

  it("slices the last branch to the end of the enclosing block", () => {
    expect(njsCalls(njsNumericBranch(bonus, 30, second.params)!)).toEqual([{ block: "Thirty" }]);
  });

  it("only takes a parameter as the dispatcher: 25==l (a loop variable) is not 25==b", () => {
    expect(bonus.indexOf("25==l")).toBeLessThan(bonus.indexOf("25==b"));
    expect(njsNumericBranch(bonus, 25, second.params)!.startsWith("25==b")).toBe(true);
    expect(njsNumericBranch(bonus, 25, ["d", "x"])).toBeUndefined();
    expect(njsNumericBranch(bonus, 25, [])).toBeUndefined();
  });

  it("does not mistake -1==b for 1==b", () => {
    expect(bonus).toContain("-1==b");
    expect(njsNumericBranch(bonus, 1, second.params)).toBeUndefined();
  });

  it("returns undefined for a branch that does not exist", () => {
    expect(njsNumericBranch(bonus, 99, second.params)).toBeUndefined();
  });
});

describe("njsNamedBlocks / njsNamedBlock with a name used by several blocks of one function", () => {
  // The game runs every `if("Etc"==d)` block when the name matches. Three body shapes: a brace block,
  // a `for` statement (inside another block, with a tail after it that runs whatever the name),
  // and an `if/else` statement, each followed by code that is not part of the block.
  const multi = njsFunction(
    [
      `m._customBlock_Multi=function(d){`,
      `if("Etc"==d){x._customBlock_A(1);k=2}`,
      `if(1==m._customBlock_Gate("g")){if("Etc"==d)for(i=0;i<3;)k._customBlock_B("a;}b"),i++;x._customBlock_Shared()}`,
      `if("Etc"==d)if(z)k._customBlock_C(3);else{k._customBlock_D(4)}`,
      `k._customBlock_After()};`,
    ].join(""),
    "Multi"
  )!;

  it("returns every block, each ending where its statement ends", () => {
    const blocks = njsNamedBlocks(multi.body, "Etc");
    expect(blocks.map((b) => njsCalls(b).map((c) => c.block))).toEqual([["A"], ["B"], ["C", "D"]]);
    expect(blocks[1]).toBe(`for(i=0;i<3;)k._customBlock_B("a;}b"),i++;`);
  });

  it("njsNamedBlock joins them, so the calls of all are found", () => {
    expect(njsCalls(njsNamedBlock(multi.body, "Etc")!)).toEqual([
      { block: "A", arg0: 1, args: [1] },
      { block: "B", arg0: "a;}b", args: ["a;}b"] },
      { block: "C", arg0: 3, args: [3] },
      { block: "D", arg0: 4, args: [4] },
    ]);
    expect(njsNamedBlocks(multi.body, "Missing")).toEqual([]);
  });
});

describe("njsNamedBlocks with the ternary dispatch (\"X\"==d?(...):...)", () => {
  // The chain TotalStats uses: each consequent runs from after `?` to the `:` that matches it.
  const tern = njsFunction(
    [
      `m._customBlock_Tern=function(d){`,
      `"STR"==d?(b=x._customBlock_A(1),e=k._customBlock_B("a?:b")):"AGI"==d?(x._customBlock_C(2)):`,
      `"WIS"==d?g?x._customBlock_E(4):x._customBlock_F(5):"LUK"==d&&(x._customBlock_D(3));`,
      `if("STR"==d)k._customBlock_IfForm(9);`,
      `return"Last"==d?x._customBlock_G(7):0};`,
    ].join(""),
    "Tern"
  )!;

  it("slices the consequent up to its matching colon, string-aware", () => {
    expect(njsNamedBlocks(tern.body, "AGI")).toEqual([`(x._customBlock_C(2))`]);
    expect(njsNamedBlocks(tern.body, "Last")).toEqual([`x._customBlock_G(7)`]);
    expect(njsCalls(njsNamedBlock(tern.body, "STR")!)).toEqual([
      { block: "A", arg0: 1, args: [1] },
      { block: "B", arg0: "a?:b", args: ["a?:b"] },
      { block: "IfForm", arg0: 9, args: [9] },
    ]);
  });

  it("skips nested ?: pairs of the consequent, so its colon is not taken for the end", () => {
    expect(njsNamedBlocks(tern.body, "WIS")).toEqual([`g?x._customBlock_E(4):x._customBlock_F(5)`]);
  });

  it("returns the if-form and the ternary form of one name together, in source order", () => {
    expect(njsNamedBlocks(tern.body, "STR").map((b) => njsCalls(b).map((c) => c.block))).toEqual([["A", "B"], ["IfForm"]]);
  });

  it("does not read the `&&` tail of a chain (\"LUK\"==d&&(...)), and never guesses a ternary it cannot close", () => {
    expect(njsNamedBlocks(tern.body, "LUK")).toEqual([]);
    expect(njsNamedBlocks(`return"X"==d?x._customBlock_A(1)}`, "X")).toEqual([]); // no colon before the block closes
    expect(njsNamedBlocks(`"X"==d?x._customBlock_A(1)`, "X")).toEqual([]); // nor before the text ends
  });
});

describe("njsNamedBlocks with an if that tests several names", () => {
  const multi = `if("A"==d||"B"==d||"C"==d)b=x._customBlock_One(1),e=k._customBlock_Two(2);k._customBlock_After();`;

  it("finds the block under each of the names, ending at its statement", () => {
    for (const name of ["A", "B", "C"]) expect(njsNamedBlocks(multi, name)).toEqual(["b=x._customBlock_One(1),e=k._customBlock_Two(2);"]);
    expect(njsNamedBlocks(multi, "D")).toEqual([]);
  });
});

describe("njsSlice (the N.js text a trace node stands for)", () => {
  const fn = njsFunction(
    [
      `m._customBlock_Sl=function(d,b,e){`,
      `if("Named"==d){if(7==b)k._customBlock_Seven();25==b&&k._customBlock_TwentyFive()}`,
      `"Tern"==d?k._customBlock_T(1):0;`,
      `return 1};`,
    ].join(""),
    "Sl"
  )!;

  it("a non-string first argument is the whole function", () => {
    expect(njsSlice(fn, [3])).toBe(fn.body);
    expect(njsSlice(fn, [])).toBe(fn.body);
  });

  it("a string and a number is the numeric branch of the named block", () => {
    expect(njsCalls(njsSlice(fn, ["Named", 25])!).map((c) => c.block)).toEqual(["TwentyFive"]);
  });

  it("falls back to the whole named block when the numeric branch is missing (Summoning(\"VaultUpgBonus\",20,0) has no 20==b)", () => {
    expect(njsCalls(njsSlice(fn, ["Named", 99, 0])!).map((c) => c.block)).toEqual(["Seven", "TwentyFive"]);
    expect(njsCalls(njsSlice(fn, ["Named"])!).map((c) => c.block)).toEqual(["Seven", "TwentyFive"]);
  });

  it("reads a ternary-dispatched name, and has no slice for a name the function never dispatches on", () => {
    expect(njsCalls(njsSlice(fn, ["Tern"])!)).toEqual([{ block: "T", arg0: 1, args: [1] }]);
    expect(njsSlice(fn, ["Nope", 1])).toBeUndefined();
  });
});

describe("njsSlice keeps the prelude (what the game runs before the dispatch)", () => {
  const fn = njsFunction(`m._customBlock_Pre=function(d){x=k._customBlock_F(1);if("A"==d)return k._customBlock_G(x);if("B"==d)return k._customBlock_H()};`, "Pre")!;

  it("a named sub-case holds the prelude and its own block, not another sub-case", () => {
    expect(njsCalls(njsSlice(fn, ["A"])!).map((c) => c.block)).toEqual(["F", "G"]);
    expect(njsCalls(njsSlice(fn, ["B"])!).map((c) => c.block)).toEqual(["F", "H"]);
  });

  it("a block guarded by a negated test of the sub-case's own name leaves its prelude; another name's stays", () => {
    const n = njsFunction(`m._customBlock_N=function(d){x=k._customBlock_F();if("A"!=d){k._customBlock_G()}if("A"==d)return k._customBlock_H(x);if("B"==d)return 0};`, "N")!;
    expect(njsCalls(njsSlice(n, ["A"])!).map((c) => c.block)).toEqual(["F", "H"]);
    const m = njsFunction(`m._customBlock_N=function(d){x=k._customBlock_F();if("A"!=d){k._customBlock_G()}if("B"==d)return k._customBlock_H(x)};`, "N")!;
    expect(njsCalls(njsSlice(m, ["B"])!).map((c) => c.block)).toEqual(["F", "G", "H"]);
    const c = njsFunction(`m._customBlock_N=function(d){if("A"!=d&&q){k._customBlock_G()}if("A"==d)return k._customBlock_H()};`, "N")!;
    expect(njsCalls(njsSlice(c, ["A"])!).map((x) => x.block)).toEqual(["G", "H"]);
  });

  it("a ternary-first function has no prelude: its slice is the named block alone", () => {
    const t = njsFunction(`m._customBlock_T=function(d){return"A"==d?k._customBlock_G(1):0};`, "T")!;
    expect(njsPrelude(t)).toBe("");
  });

  it("a local named like the parameter (`dd`) does not end the prelude", () => {
    const t = njsFunction(`m._customBlock_L=function(d){var dd=2;if("A"==dd)x=k._customBlock_G(1);if("B"==d)return k._customBlock_H()};`, "L")!;
    expect(njsPrelude(t)).toBe(`var dd=2;if("A"==dd)x=k._customBlock_G(1);`);
  });
});

// The live bundle is 25 MB: read and normalize it once for the file.
const NJS = "scripts/updater/.cache/N.new.js";
describe.skipIf(!existsSync(NJS))("the live N.js", () => {
  let sailing: NonNullable<ReturnType<typeof njsFunction>>;
  let totalStats: NonNullable<ReturnType<typeof njsFunction>>;
  let summoning: NonNullable<ReturnType<typeof njsFunction>>;
  let afk: NonNullable<ReturnType<typeof njsFunction>>;
  let stampBonus: NonNullable<ReturnType<typeof njsFunction>>;
  const artifact25 = () => njsNumericBranch(njsNamedBlock(sailing.body, "ArtifactBonus")!, 25, sailing.params)!;
  beforeAll(() => {
    const norm = normalizeBundle(readFileSync(NJS, "utf8"));
    sailing = njsFunction(norm, "Sailing")!;
    totalStats = njsFunction(norm, "TotalStats")!;
    summoning = njsFunction(norm, "Summoning")!;
    stampBonus = njsFunction(norm, "StampBonusOfTypeX")!;
    afk = njsFunction(norm, "AFKgainrates")!;
  }, 120_000);

  it("holds _customBlock_Sailing(d,b,e)", () => {
    expect(sailing.params).toEqual(["d", "b", "e"]);
    expect(sailing.body.startsWith("{")).toBe(true);
    expect(sailing.body.length).toBeGreaterThan(1000);
  });

  it("calls TotalStats in the ArtifactBonus 25 sub-branch of _customBlock_Sailing (the Artifact 25 bug)", () => {
    const block = njsNamedBlock(sailing.body, "ArtifactBonus")!;
    const slice = artifact25();
    expect(slice.startsWith("25==b")).toBe(true);
    expect(slice.length).toBeLessThan(block.length / 2); // a slice, not the whole ArtifactBonus block
    const calls = njsCalls(slice);
    expect(calls.map((c) => c.block)).toContain("ReturnClasses");
    // the first argument is an expression (""+h.string(...)), not a literal
    expect(calls.find((c) => c.block === "TotalStats")).toStrictEqual({ block: "TotalStats" });
  });

  it("reads every calcEtcBonuses block of _customBlock_TotalStats, not only the first (a 0-call brace block)", () => {
    const blocks = njsNamedBlocks(totalStats.body, "calcEtcBonuses");
    expect(blocks.length).toBeGreaterThan(1);
    expect(njsCalls(blocks[0])).toEqual([]);
    expect(njsCalls(njsNamedBlock(totalStats.body, "calcEtcBonuses")!).length).toBeGreaterThan(0);
  });

  it("reads the ternary dispatch of _customBlock_TotalStats (\"STR\"==d?...): the STR block makes calls", () => {
    const calls = njsCalls(njsNamedBlock(totalStats.body, "STR")!);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls).toContainEqual(expect.objectContaining({ block: "StampBonusOfTypeX", arg0: "PctSTR" }));
  });

  it("has a slice for Summoning(\"VaultUpgBonus\",20,0) though the block has no 20==b branch, and for StampBonusOfTypeX(\"BaseDmg\")", () => {
    const named = njsNamedBlock(summoning.body, "VaultUpgBonus")!;
    expect(njsNumericBranch(named, 20, summoning.params)).toBeUndefined();
    expect(njsSlice(summoning, ["VaultUpgBonus", 20, 0])).toBe(named);
    // an `if("BaseDmg"==d||"BaseHP"==d||…)`, not a ternary
    expect(njsCalls(njsSlice(stampBonus, ["BaseDmg"])!)).toContainEqual(expect.objectContaining({ block: "Summoning", arg0: "VaultUpgBonus" }));
  });

  it("AFKgainrates(\"Fighting\") skips the `\"Fighting\"!=d` block", () => {
    const calls = njsCalls(njsSlice(afk, ["Fighting"])!);
    for (const [block, arg0] of [["TalentEnh", 79], ["CardBonusREAL", 46], ["GuildBonuses", 7], ["chipBonuses", "safk"], ["EtcBonuses", "24"]] as const)
      expect(calls, `${block}(${arg0})`).not.toContainEqual(expect.objectContaining({ block, arg0 }));
  });

  it("AFKgainrates(\"Fighting\") reaches the calls the game makes before its dispatch", () => {
    const calls = njsCalls(njsSlice(afk, ["Fighting"])!);
    for (const [block, arg0] of [["Divinity", "Bonus_MAJOR"], ["ArcaneType", "ArcaneMapMulti_bon"], ["EtcBonuses", "92"], ["Summoning", "VotingBonusz"]] as const)
      expect(calls, `${block}(${arg0})`).toContainEqual(expect.objectContaining({ block, arg0 }));
  });

  it("a synthetic trace of Artifact 25 without TotalStats reports it missing, and with it does not", () => {
    const ours = traceCalls(root(node("ReturnClasses", [])));
    expect(callDiff(njsCalls(artifact25()), ours).missing).toContainEqual({ block: "TotalStats" });
    expect(callDiff(njsCalls(artifact25()), [...ours, ...traceCalls(root(node("TotalStats", ["STR"])))]).missing).not.toContainEqual({ block: "TotalStats" });
  });
});
