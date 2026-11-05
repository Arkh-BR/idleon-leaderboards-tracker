import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { njsClosure, njsFunction } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";
import { renderInventory, runClosure, runClosures } from "@/scripts/njs-closure";

// A tiny bundle in the shape of the normalized N.js: one named sub-case that calls a numeric
// branch, a literal-arg stop, a whole-body call, a missing function and a read of attributes.
const synthetic = [
  `m._customBlock_Root=function(d,b){`,
  `if("Top"==d){k._customBlock_Mid("Sub",2,b,9);k._customBlock_Whole(3);k._customBlock_Gone("x")}`,
  `if("Not"==d)k._customBlock_Unreached(1)};`,
  `m._customBlock_Mid=function(d,b,e){`,
  `if("Sub"==d){if(2==b)k._customBlock_Leaf("L",e.h.q,0),a.engine.getGameAttribute("Captains");if(5==b)k._customBlock_Unreached(2)}};`,
  `m._customBlock_Whole=function(d){return k._customBlock_Hidden(1)+a.engine.getGameAttribute("Secret")};`,
  `m._customBlock_Leaf=function(d,b,e){if("L"==d)return a.engine.getGameAttribute("DNSM").h.StarSigns+a.engine.gameAttributes.h.Boats[0]};`,
].join("");

describe("njsClosure on a synthetic bundle", () => {
  const r = njsClosure(synthetic, "Root", ["Top"]);
  const row = (fn: string) => r.calls.find((c) => c.fn === fn);

  it("follows the named sub-case and its numeric branch, breadth first, and stops args at the first non-literal", () => {
    expect(r.calls.map((c) => [c.fn, c.args, c.depth])).toEqual([
      ["Root", ["Top"], 0],
      ["Mid", ["Sub", 2], 1], // Mid("Sub",2,b,9): b is not a literal
      ["Whole", [3], 1],
      ["Gone", ["x"], 1],
      ["Leaf", ["L"], 2], // Leaf("L",e.h.q,0)
    ]);
    expect(r.calls.some((c) => c.fn === "Unreached")).toBe(false); // the other sub-case and the 5== branch
  });

  it("flags a whole-body slice and does not walk into it, and flags a function that does not exist", () => {
    expect(row("Whole")).toMatchObject({ flag: "whole body" });
    expect(row("Gone")).toMatchObject({ flag: "not found", chars: 0 });
    expect(r.calls.some((c) => c.fn === "Hidden")).toBe(false);
    expect(row("Mid")!.flag).toBeUndefined();
    expect(row("Mid")!.chars).toBeGreaterThan(0);
  });

  it("collects the attributes and DNSM keys of the slices, and marks those only a whole-body row reads as loose", () => {
    expect(r.attrs).toEqual(["Boats", "Captains", "DNSM", "Secret"]);
    expect(r.dnsm).toEqual(["StarSigns"]);
    expect(r.loose).toEqual({ attrs: ["Secret"], dnsm: [] });
  });

  it("finds a sub-case in the function the first one hands its own params to (Summoning -> Summoning2)", () => {
    const dlg = [
      `m._customBlock_Dlg=function(d,b){if("near"==d)return 1;return k._customBlock_Dlg2(d,b)+a.engine.getGameAttribute("Lazy")+a.engine.getGameAttribute("DNSM").h.Scratch};`,
      `m._customBlock_Dlg2=function(d,b){if("far"==d)return k._customBlock_End("e")};`,
      `m._customBlock_End=function(d){if("e"==d)return 2};`,
      `m._customBlock_Top=function(d){if("t"==d)return k._customBlock_Dlg("far")+k._customBlock_Dlg("near")+k._customBlock_Dlg("none")};`,
    ].join("");
    const r = njsClosure(dlg, "Top", ["t"]);
    expect(r.calls.map((c) => [c.fn, c.args, c.flag, c.via])).toEqual([
      ["Top", ["t"], undefined, undefined],
      ["Dlg", ["far"], undefined, "Dlg2"],
      ["Dlg", ["near"], undefined, undefined],
      ["Dlg", ["none"], "whole body", undefined], // no slice anywhere: the function exists, so its whole body
      ["End", ["e"], undefined, undefined],
    ]);
    // ...with the size and the loose reads of that body, and none of its callees walked (Dlg2 is only the "far" row's)
    expect(r.calls[3].chars).toBe(njsFunction(dlg, "Dlg")!.body.length);
    expect(r.loose).toEqual({ attrs: ["DNSM", "Lazy"], dnsm: ["Scratch"] });
    expect(r.calls.filter((c) => c.fn === "Dlg2")).toEqual([]);
  });

  it("narrows a numeric dispatcher to its branch and walks only that; no branch for the number keeps the whole body", () => {
    const num = [
      `m._customBlock_Top=function(d){if("t"==d)return k._customBlock_Disp(2)+k._customBlock_Disp(7)};`,
      `m._customBlock_Disp=function(d){if(2==d)return k._customBlock_Two("x")+a.engine.getGameAttribute("OnlyTwo");if(5==d)return k._customBlock_Five("y")+a.engine.getGameAttribute("OnlyFive")};`,
      `m._customBlock_Two=function(d){if("x"==d)return 2};m._customBlock_Five=function(d){if("y"==d)return 5};`,
    ].join("");
    const r = njsClosure(num, "Top", ["t"]);
    expect(r.calls.map((c) => [c.fn, c.args, c.flag])).toEqual([
      ["Top", ["t"], undefined],
      ["Disp", [2], undefined], // narrowed to 2==d: no flag, and its calls are walked
      ["Disp", [7], "whole body"], // no 7==d branch
      ["Two", ["x"], undefined],
    ]);
    expect(r.attrs).toEqual(["OnlyFive", "OnlyTwo"]); // the whole-body row still reads both
    expect(r.loose.attrs).toEqual(["OnlyFive"]);
  });

  it("walks a function with no parameters: its whole body is the formula, not a missing slice", () => {
    const zero = [
      `m._customBlock_Top=function(d){if("t"==d)return k._customBlock_Zero()+k._customBlock_Param(d)};`,
      `m._customBlock_Zero=function(){return k._customBlock_Leaf("L",1,0)+a.engine.getGameAttribute("ZeroRead")};`,
      `m._customBlock_Param=function(d){return k._customBlock_Hidden(1)};`,
      `m._customBlock_Leaf=function(d,b,e){if("L"==d)return 1};`,
    ].join("");
    const r = njsClosure(zero, "Top", ["t"]);
    expect(r.calls.map((c) => [c.fn, c.args, c.flag])).toEqual([
      ["Top", ["t"], undefined],
      ["Zero", [], undefined],
      ["Param", [], "whole body"], // a parameter we cannot read the value of: which branch is unknown
      ["Leaf", ["L", 1, 0], undefined],
    ]);
    expect(r.loose.attrs).toEqual([]); // ZeroRead is an exact read
  });

  it("walks a cycle once", () => {
    const loop = `m._customBlock_A=function(d){if("a"==d)return k._customBlock_A("a")+k._customBlock_B("b")};m._customBlock_B=function(d){if("b"==d)return k._customBlock_A("a")};`;
    expect(njsClosure(loop, "A", ["a"]).calls.map((c) => c.fn)).toEqual(["A", "B"]);
  });

  it("stops at depth 6 and says how many calls it left out", () => {
    const chain = Array.from({ length: 9 }, (_, i) => `m._customBlock_F${i}=function(d){if("a"==d)return k._customBlock_F${i + 1}("a")};`).join("");
    const capped = njsClosure(chain, "F0", ["a"]);
    expect(capped.calls.map((c) => c.depth)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(capped.capped).toBe(1);
    expect(r.capped).toBe(0);
  });
});

describe("runClosure (the CLI's work)", () => {
  it("parses numeric args as numbers and walks the root", () => {
    expect(runClosure(synthetic, ["Mid", "Sub", "2"]).calls.map((c) => [c.fn, c.args])).toEqual([["Mid", ["Sub", 2]], ["Leaf", ["L"]]]);
  });

  it("refuses a root function that is not in N.js, and a missing name", () => {
    expect(() => runClosure(synthetic, ["Nope", "x"])).toThrow("no _customBlock_Nope in the live N.js");
    expect(() => runClosure(synthetic, [])).toThrow(/usage/);
  });
});

describe("runClosures (several roots, one inventory)", () => {
  it("merges the rows once, with the roots that reach each", () => {
    const r = runClosures(synthetic, ["Mid", "Sub", "2", "+", "Root", "Top"]);
    expect(r.calls.map((c) => [c.fn, c.args, c.roots])).toEqual([
      ["Mid", ["Sub", 2], ['Mid("Sub",2)', 'Root("Top")']],
      ["Leaf", ["L"], ['Mid("Sub",2)', 'Root("Top")']],
      ["Root", ["Top"], ['Root("Top")']],
      ["Whole", [3], ['Root("Top")']],
      ["Gone", ["x"], ['Root("Top")']],
    ]);
    expect(r.calls.find((c) => c.fn === "Mid")!.depth).toBe(0); // the shallowest of the two
    const md = renderInventory(r, "h");
    expect(md).toContain("Roots: R1 = `Mid(\"Sub\",2)`, R2 = `Root(\"Top\")`.");
    expect(md).toContain(`Gone("x") — depth 1 — 0 chars — not found — roots: R2`);
    expect(md).toContain(`Leaf("L") — depth 1 — `);
    expect(md).toContain(` — roots: R1 R2
`);
  });
});

describe("renderInventory", () => {
  it("is a checklist grouped by function, with the flags and the attrs and dnsm sections", () => {
    const md = renderInventory(njsClosure(synthetic, "Root", ["Top"]), "header line");
    expect(md.startsWith("header line\n")).toBe(true);
    expect(md).toContain(`## Mid\n\n- [ ] Mid("Sub",2) — depth 1 — `);
    expect(md).toMatch(/- \[ \] Whole\(3\) — depth 1 — \d+ chars — whole body\n/);
    expect(md).toContain(`- [ ] Gone("x") — depth 1 — 0 chars — not found\n`);
    expect(md).toContain("## attrs\n\n- [ ] `Boats`\n- [ ] `Captains`\n- [ ] `DNSM`\n- [ ] `Secret` — whole body only\n");
    expect(md).toContain("## dnsm\n\n- [ ] `StarSigns`\n");
  });
});

// The live bundle is 25 MB: read and normalize it once for the file.
const NJS = "scripts/updater/.cache/N.new.js";
describe.skipIf(!existsSync(NJS))("the closure of Sailing(\"BoatArtiMulti\", 0) in the live N.js", () => {
  let r: ReturnType<typeof njsClosure>;
  beforeAll(() => {
    r = njsClosure(loadNjs(), "Sailing", ["BoatArtiMulti", 0]);
  }, 180_000);

  const has = (fn: string, args: (string | number)[]) => r.calls.some((c) => c.fn === fn && JSON.stringify(c.args) === JSON.stringify(args));

  it("reaches the artifact, vault and voting sub-cases", () => {
    expect(has("Sailing", ["ArtifactBonus", 3, 0])).toBe(true);
    expect(has("Summoning", ["VaultUpgBonus", 63, 0])).toBe(true);
    expect(has("Summoning", ["VotingBonusz", 20, 0])).toBe(true);
  });

  it("finds VotingBonusz in Summoning2, where Summoning hands it on", () => {
    expect(r.calls.find((c) => c.fn === "Summoning" && c.args[0] === "VotingBonusz" && c.args[1] === 20)).toMatchObject({ via: "Summoning2" });
    expect(r.calls.filter((c) => c.flag === "not found").map((c) => c.fn)).not.toContain("Summoning");
  });

  it("keeps a function with no sub-case slice as a whole-body row, with its attributes (GetBribeBonus(\"34\") reads BribeStatus)", () => {
    const bribe = r.calls.find((c) => c.fn === "GetBribeBonus")!;
    expect(bribe).toMatchObject({ flag: "whole body" });
    expect(bribe.chars).toBeGreaterThan(0);
    expect(r.calls.filter((c) => c.flag === "not found")).toEqual([]); // every function it calls exists
    expect(r.attrs).toEqual(expect.arrayContaining(["BribeStatus", "StampLevel"]));
    expect(r.loose.attrs).toEqual(expect.arrayContaining(["BribeStatus", "StampLevel"]));
  });

  it("reads the Captains and Boats attributes and the StarSigns and AlchVials DNSM keys", () => {
    expect(r.attrs).toEqual(expect.arrayContaining(["Captains", "Boats"]));
    expect(r.dnsm).toEqual(expect.arrayContaining(["StarSigns", "AlchVials"]));
  });
});

describe.skipIf(!existsSync(NJS))("the closure of DamageDealed(\"Max\") in the live N.js", () => {
  let r: ReturnType<typeof njsClosure>;
  beforeAll(() => {
    r = njsClosure(loadNjs(), "DamageDealed", ["Max"]);
  }, 180_000);

  it("has fewer whole-body rows than before the numeric narrowing (230)", () => {
    expect(r.calls.filter((c) => c.flag === "whole body").length).toBeLessThan(230);
  });

  it("slices GetTalentNumber(1,95) to its 1==d branch, and keeps a generic function (ArcadeBonus has no branch for 46) whole", () => {
    expect(r.calls.find((c) => c.fn === "GetTalentNumber" && c.args[0] === 1)?.flag).toBeUndefined();
    expect(r.calls.find((c) => c.fn === "ArcadeBonus" && c.args[0] === 46)?.flag).toBe("whole body");
  });
});
