import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { njsClosure } from "@/lib/diagnose/njsCalls";
import { loadNjs } from "@/scripts/njs-calls";
import { renderInventory } from "@/scripts/njs-closure";

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

  it("flags a whole-body slice and does not walk into it, and flags a function it cannot find", () => {
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
      `m._customBlock_Dlg=function(d,b){if("near"==d)return 1;return k._customBlock_Dlg2(d,b)};`,
      `m._customBlock_Dlg2=function(d,b){if("far"==d)return k._customBlock_End("e")};`,
      `m._customBlock_End=function(d){if("e"==d)return 2};`,
      `m._customBlock_Top=function(d){if("t"==d)return k._customBlock_Dlg("far")+k._customBlock_Dlg("near")+k._customBlock_Dlg("none")};`,
    ].join("");
    expect(njsClosure(dlg, "Top", ["t"]).calls.map((c) => [c.fn, c.args, c.flag, c.via])).toEqual([
      ["Top", ["t"], undefined, undefined],
      ["Dlg", ["far"], undefined, "Dlg2"],
      ["Dlg", ["near"], undefined, undefined],
      ["Dlg", ["none"], "not found", undefined],
      ["End", ["e"], undefined, undefined],
    ]);
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

  it("reads the Captains and Boats attributes and the StarSigns and AlchVials DNSM keys", () => {
    expect(r.attrs).toEqual(expect.arrayContaining(["Captains", "Boats"]));
    expect(r.dnsm).toEqual(expect.arrayContaining(["StarSigns", "AlchVials"]));
  });
});
