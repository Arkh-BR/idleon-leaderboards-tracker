import { describe, it, expect, vi } from "vitest";
import { diffSaves, diffTrees } from "@/lib/diagnose/saveDiff";

const env = (data: Record<string, unknown>) => ({ data, lastUpdated: 1 });

describe("diffSaves", () => {
  it("names a changed nested array element like EquipOrder_8[0][1]", () => {
    const a = env({ EquipOrder_8: [["Blank", "Sword", "Hat"]], Same: [1, 2] });
    const b = env({ EquipOrder_8: [["Blank", "Blank", "Hat"]], Same: [1, 2] });
    expect(diffSaves(a, b)).toEqual([{ path: "EquipOrder_8[0][1]", before: "Sword", after: "Blank" }]);
  });

  it("reports an added key, and a removed one, as a whole value", () => {
    const a = env({ Gone: [1, 2], Keep: 1 });
    const b = env({ New: { x: [1] }, Keep: 1 });
    expect(diffSaves(a, b)).toEqual([
      { path: "Gone", before: [1, 2], after: undefined },
      { path: "New", before: undefined, after: { x: [1] } },
    ]);
  });

  it("parses JSON-string fields before diffing, as the loader does", () => {
    const a = env({ EquipOrder_8: JSON.stringify([["Blank", "Sword"]]), Lv0_3: "[5,6]" });
    // Same content, one side a string and the other already parsed: no change.
    const same = env({ EquipOrder_8: [["Blank", "Sword"]], Lv0_3: [5, 6] });
    expect(diffSaves(a, same)).toEqual([]);
    const b = env({ EquipOrder_8: JSON.stringify([["Blank", "Axe"]]), Lv0_3: "[5,7]" });
    expect(diffSaves(a, b)).toEqual([
      { path: "EquipOrder_8[0][1]", before: "Sword", after: "Axe" },
      { path: "Lv0_3[1]", before: 6, after: 7 },
    ]);
  });

  it("keeps a non-JSON string as a string, silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const d = diffSaves(env({ AFKtarget_0: "Laboratory" }), env({ AFKtarget_0: "Nothing" }));
      expect(d).toEqual([{ path: "AFKtarget_0", before: "Laboratory", after: "Nothing" }]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("reads an object keyed by numbers (how saves store EquipOrder rows) like an array", () => {
    const a = env({ EquipOrder_8: [{ 0: "Hat", 1: "Sword", 10: "Ring" }], Lv0_10: [1], Lv0_3: [1] });
    const b = env({ EquipOrder_8: [{ 0: "Hat", 1: "Blank", 2: "Boots", 10: "Gem" }], Lv0_10: [2], Lv0_3: [2] });
    expect(diffSaves(a, b).map((x) => x.path)).toEqual(["EquipOrder_8[0][1]", "EquipOrder_8[0][2]", "EquipOrder_8[0][10]", "Lv0_3[0]", "Lv0_10[0]"]);
  });

  it("names object fields with a dot, a grown array by its new index, a type change at its own path", () => {
    const a = env({ O: { slot: { lv: 1 } }, L: [1], T: [1, 2] });
    const b = env({ O: { slot: { lv: 2 } }, L: [1, 9], T: { k: 1 } });
    expect(diffSaves(a, b)).toEqual([
      { path: "L[1]", before: undefined, after: 9 },
      { path: "O.slot.lv", before: 1, after: 2 },
      { path: "T", before: [1, 2], after: { k: 1 } },
    ]);
  });

  it("lists changes in path order and accepts an envelope without `data`", () => {
    const d = diffSaves({ B: [1, 2, 3], A: 1 }, { B: [1, 2, 4], A: 2 });
    expect(d.map((x) => x.path)).toEqual(["A", "B[2]"]);
  });
});

describe("diffTrees", () => {
  const a = { R: 10, "R / g": 4, "R / g / x": 1, "R / g / y": 3, "R / h": 6 };

  it("returns the changed leaves, not the parents that merely add them up", () => {
    const b = { ...a, "R / g / y": 5, R: 12, "R / g": 6 };
    expect(diffTrees(a, b)).toEqual([{ path: "R / g / y", before: 3, after: 5 }]);
  });

  it("drops changes below the relative threshold", () => {
    const b = { ...a, "R / h": 6 * (1 + 1e-12), "R / g / x": 1.5 };
    expect(diffTrees(a, b).map((x) => x.path)).toEqual(["R / g / x"]);
    // a looser threshold drops the 50% one too; a zero threshold keeps both
    expect(diffTrees(a, b, 0.6)).toEqual([]);
    expect(diffTrees(a, b, 0).map((x) => x.path)).toEqual(["R / g / x", "R / h"]);
  });

  it("reports leaves that appear or disappear, and 0 → x", () => {
    const b = { R: 10, "R / g": 4, "R / g / x": 0, "R / g / y": 3, "R / h": 6, "R / n": 2 };
    expect(diffTrees({ ...a, "R / g / x": 1 }, b)).toEqual([
      { path: "R / g / x", before: 1, after: 0 },
      { path: "R / n", before: undefined, after: 2 },
    ]);
    expect(diffTrees({ R: 1, "R / z": 0 }, { R: 1, "R / z": 3 })).toEqual([{ path: "R / z", before: 0, after: 3 }]);
  });

  it("is empty for equal trees", () => {
    expect(diffTrees(a, { ...a })).toEqual([]);
  });
});
