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
});
