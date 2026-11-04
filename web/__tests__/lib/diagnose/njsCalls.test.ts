import { beforeAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { callDiff, njsCalls, njsFunction, njsNamedBlock, njsNumericBranch, traceCalls } from "@/lib/diagnose/njsCalls";
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
      { block: "Summoning", arg0: "VaultUpgBonus" },
      { block: "TotalStats", arg0: "STR" },
    ]);
  });

  it("reads a bare k.GetTalentNumber(1,95) and its _customBlock_ spelling as the same call, with a numeric arg0", () => {
    expect(njsCalls("k.GetTalentNumber(1,95)")).toEqual([{ block: "GetTalentNumber", arg0: 1 }]);
    expect(njsCalls("k._customBlock_GetTalentNumber(1,95)")).toEqual([{ block: "GetTalentNumber", arg0: 1 }]);
  });

  it("has no arg0 when the first argument is not a lone literal, and still finds calls nested in it", () => {
    const calls = njsCalls(`x._customBlock_TotalStats(""+h.string(f.h[v][0]))+k._customBlock_Foo(1+n)+k._customBlock_Bar()`);
    expect(calls).toStrictEqual([{ block: "TotalStats" }, { block: "Foo" }, { block: "Bar" }]);
    expect(njsCalls(`m._customBlock_A(m._customBlock_B("s"),2)`)).toEqual([{ block: "A" }, { block: "B", arg0: "s" }]);
  });

  it("reads negative and decimal numbers, and an empty string", () => {
    expect(njsCalls(`k._customBlock_A(-1,0)+k._customBlock_B(.5)+k._customBlock_C(2.25)+k._customBlock_D("")`)).toEqual([
      { block: "A", arg0: -1 },
      { block: "B", arg0: 0.5 },
      { block: "C", arg0: 2.25 },
      { block: "D", arg0: "" },
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
    expect(njsCalls(njsNamedBlock(njsFunction(norm, "First")!.body, "Bonus")!)).toEqual([{ block: "Other", arg0: 1 }]);
    expect(njsCalls(bonus).map((c) => c.block)).toEqual(["One", "Loop", "Neg", "Two", "TwentyFive", "TotalStats", "Thirty"]);
    expect(njsNamedBlock(njsFunction(norm, "Third")!.body, "Bonus")).toBeUndefined();
    expect(njsNamedBlock(second.body, "Missing")).toBeUndefined();
    expect(njsNamedBlock(second.body, "a.*")).toBeUndefined(); // a name, not a pattern
  });

  it("slices a numeric sub-branch from n==v to the next <digits>==v", () => {
    const slice = njsNumericBranch(bonus, 25, second.params)!;
    expect(slice.startsWith("25==b&&")).toBe(true);
    expect(njsCalls(slice)).toEqual([{ block: "TwentyFive", arg0: 3 }, { block: "TotalStats" }]);
    expect(njsCalls(njsNumericBranch(bonus, 2, second.params)!)).toEqual([{ block: "Two", arg0: "t" }]);
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

// The live bundle is 25 MB: read and normalize it once for the file.
const NJS = "scripts/updater/.cache/N.new.js";
describe.skipIf(!existsSync(NJS))("the live N.js", () => {
  let sailing: NonNullable<ReturnType<typeof njsFunction>>;
  const artifact25 = () => njsNumericBranch(njsNamedBlock(sailing.body, "ArtifactBonus")!, 25, sailing.params)!;
  beforeAll(() => {
    sailing = njsFunction(normalizeBundle(readFileSync(NJS, "utf8")), "Sailing")!;
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

  it("would have caught the old bug: a trace of Artifact 25 without TotalStats misses it", () => {
    const ours = traceCalls(root(node("ReturnClasses", [])));
    expect(callDiff(njsCalls(artifact25()), ours).missing).toContainEqual({ block: "TotalStats" });
    expect(callDiff(njsCalls(artifact25()), [...ours, ...traceCalls(root(node("TotalStats", ["STR"])))]).missing).not.toContainEqual({ block: "TotalStats" });
  });
});
