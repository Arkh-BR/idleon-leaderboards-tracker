import { describe, it, expect } from "vitest";
import { extractFormulas } from "../../scripts/updater/extract-formulas";

describe("extractFormulas", () => {
  it("captures return-style gameplay custom-blocks by name", () => {
    const src =
      `z._cb=function(d,b){if("FriendBonusQTY"==d)return 0==b?100*Math.min(1.5,.25):25;` +
      `if("HatrackBonusMulti"==d)return 1+(a+b)/100;}`;
    const f = extractFormulas(src);
    expect(f["FriendBonusQTY"]).toBe("0==b?100*Math.min(1.5,.25):25");
    expect(f["HatrackBonusMulti"]).toBe("1+(a+b)/100");
  });

  it("captures block-style custom-blocks", () => {
    const src = `z._cb=function(d,b){if("FooStatz"==d){a.x=1;return 2}}`;
    const f = extractFormulas(src);
    expect(f["FooStatz"]).toBe("{a.x=1;return 2}");
  });

  it("does not break on `;` or `}` inside strings", () => {
    const src = `z._cb=function(d){if("Quip"==d)return "a;b}c";}`;
    const f = extractFormulas(src);
    expect(f["Quip"]).toBe(`"a;b}c"`);
  });

  it("captures named-blocks dispatched on non-d vars", () => {
    const src = `z._cb=function(c){if("GuildGpREQ"==c)return 5*c;}`;
    const f = extractFormulas(src);
    expect(f["GuildGpREQ"]).toBe("5*c");
  });

  it("ignores 1- and 2-char block names (noise)", () => {
    const src = `z._cb=function(a){if("t"==a)return 1;if("nm"==a)return 2;}`;
    const f = extractFormulas(src);
    expect("t" in f).toBe(false);
    expect("nm" in f).toBe(false);
  });

  it("captures a _customBlock_ scaffold including number-dispatched logic", () => {
    const src = `z._customBlock_Companions=function(d){if(918==d)return 0;return d*2}`;
    const f = extractFormulas(src);
    expect(f["_customBlock_Companions"]).toContain("918==d");
    expect(f["_customBlock_Companions"]).toContain("d*2");
  });

  it("collapses inner named-blocks in a scaffold (no redundant body)", () => {
    const src = `z._customBlock_Thingies=function(d){if("AbcQTY"==d)return 1+2;return 9}`;
    const f = extractFormulas(src);
    // granular named-block captured on its own:
    expect(f["AbcQTY"]).toBe("1+2");
    // scaffold has the structure but NOT the inner expr:
    expect(f["_customBlock_Thingies"]).toContain("~");
    expect(f["_customBlock_Thingies"]).toContain("return 9");
    expect(f["_customBlock_Thingies"]).not.toContain("1+2");
  });
});

import { extractAll } from "../../scripts/updater/extract";

describe("extractAll", () => {
  it("includes a formulas map", () => {
    const src = `z._cb=function(d){if("MonsterCash"==d)return 5;}`;
    const out = extractAll(src);
    expect(out.formulas["MonsterCash"]).toBe("5");
  });
});
