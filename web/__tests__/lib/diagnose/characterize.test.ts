import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARTIFACT_FIND_REFUSABLE, DAMAGE_REFUSABLE, characterize, classify, flaggedLeaves, realSaves, type Row } from "@/lib/diagnose/characterize";
import { MissingSaveKey, UNPORTED_STEPS } from "@/lib/game/errors";
import type { StatResult } from "@/lib/statTracker/config";

// Synthetic saves: two characters each, the "total" is read straight off the data so the fake engine is one line.
let dir: string;
const file = (name: string, data: object, chars = 2, at = dir) => {
  const p = join(at, name);
  writeFileSync(p, JSON.stringify({ charNames: Array.from({ length: chars }, (_, i) => `c${i}`), data }));
  return p;
};
let A: string, B: string, ONE: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "characterize-"));
  A = file("A.json", { v: 10 });
  B = file("B.json", { v: 20 });
  ONE = file("One.json", { v: 5 }, 1);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Tree = StatResult["tree"];
const result = (total: number, tree: Tree = { name: "t", val: total, fmt: "x" }): StatResult => ({ total, tree });
// v + character index: every (save, ci) has its own number
const engine = (save: unknown, ci: number) => result((save as { data: { v: number } }).data.v + ci);

describe("characterize", () => {
  it("has one row per (save, character) pair, with its total", () => {
    const { rows } = characterize([A, B, ONE], engine);
    expect(rows.map((r) => [r.ci, r.total])).toEqual([[0, 10], [1, 11], [0, 20], [1, 21], [0, 5]]);
    expect(rows.every((r) => r.err === undefined && r.flagged.length === 0)).toBe(true);
  });

  it("a row for a pair that throws names the error class and message", () => {
    const boom = (save: unknown, ci: number) => {
      if ((save as { data: { v: number } }).data.v === 10 && ci === 1) throw new MissingSaveKey("Menagerie");
      return result(1);
    };
    const { rows } = characterize([A], boom);
    expect(rows[0]).toMatchObject({ ci: 0, total: 1 });
    expect(rows[1]).toMatchObject({ save: A, ci: 1, err: { name: "MissingSaveKey", message: "Menagerie" }, flagged: [] });
    expect(rows[1].total).toBeUndefined();
  });

  it("keeps the tree's runtime / assumed leaves, with their paths, and no other note", () => {
    const tree: Tree = {
      name: "Damage", val: 1, fmt: "x", children: [
        { name: "a", val: 0, fmt: "raw", note: "runtime: active buff, not counted" },
        { name: "b", val: 1, fmt: "raw", note: "cached", children: [{ name: "c", val: 1, fmt: "raw", note: "assumed: lab node counted as connected" }] },
      ],
    };
    expect(flaggedLeaves(tree)).toEqual([
      { leaf: "a", note: "runtime: active buff, not counted", path: "Damage / a" },
      { leaf: "c", note: "assumed: lab node counted as connected", path: "Damage / b / c" },
    ]);
    expect(characterize([ONE], () => result(1, tree)).rows[0].flagged).toHaveLength(2);
  });

  it("times the engine over all pairs", () => {
    const spin = (save: unknown, ci: number) => {
      const t = performance.now();
      while (performance.now() - t < 2);
      return engine(save, ci);
    };
    expect(characterize([A, B, ONE], spin).ms).toBeGreaterThanOrEqual(5 * 2);
  });

  it("gives each pair its own parse of the save (an engine writing into it cannot change the next pair's answer)", () => {
    const writer = (save: unknown, ci: number) => {
      const s = save as { data: { v: number } };
      const v = s.data.v + ci;
      s.data.v = 99;
      return result(v);
    };
    expect(characterize([A], writer).rows.map((r) => r.total)).toEqual([10, 11]);
  });

  it("a save that is not an envelope is an error, not a skipped file", () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify({ nope: 1 }));
    expect(() => characterize([bad], engine)).toThrow(/bad\.json/);
  });
});

describe("realSaves", () => {
  it("lists the envelopes at the top of the two real-save folders, sorted; other JSON, subfolders and missing folders give nothing", () => {
    const web = mkdtempSync(join(tmpdir(), "realsaves-"));
    try {
      expect(realSaves(web)).toEqual([]);
      const golden = join(web, "scripts/updater/golden/.cache");
      const fresh = join(web, "scripts/updater/.cache/saves-fresh");
      mkdirSync(join(golden, "readings"), { recursive: true });
      mkdirSync(fresh, { recursive: true });
      const z = file("Z.json", { v: 1 }, 1, golden);
      const y = file("Y.json", { v: 1 }, 1, fresh);
      file("R.json", { v: 1 }, 1, join(golden, "readings"));
      writeFileSync(join(golden, "notes.json"), "{}");
      writeFileSync(join(golden, "broken.json"), "{");
      expect(realSaves(web)).toEqual([y, z].sort());
    } finally {
      rmSync(web, { recursive: true, force: true });
    }
  });
});

describe("classify", () => {
  const row = (over: Partial<Row>): Row => ({ save: join("x", "folder", "Koweabooo.json"), ci: 10, total: 1.21, flagged: [], ...over });
  const leaf = { leaf: "a", note: "runtime: x", path: "t / a" };

  it("is clean with a total and no flagged leaf, flagged with one", () => {
    expect(classify(row({}), 34.05)).toBe("clean");
    expect(classify(row({ flagged: [leaf] }), 34.05)).toBe("flagged");
  });

  it("a non-finite total is an error", () => {
    expect(classify(row({ total: Number.NaN }), 34.05)).toBe("error");
    expect(classify(row({ total: Infinity, flagged: [leaf] }), 34.05)).toBe("error");
  });

  it("is refused when lib/game throws MissingSaveKey on a save below CSver 34.05", () => {
    const r = row({ ci: 0, total: undefined, err: { name: "MissingSaveKey", message: "Menagerie" } });
    expect(classify(r, 34.04)).toBe("refused");
    expect(classify(r, 23.05)).toBe("refused");
    expect(classify(r, 34.05)).toBe("error"); // a current save that lacks a key is a bug, not a pre-migration save
    expect(classify(r, undefined)).toBe("error");
    // the same class as the real error (its name is what the row carries)
    expect(new MissingSaveKey("k").name).toBe("MissingSaveKey");
  });

  it("with a list of keys a stat may be refused for, a refusal for any other key is an error", () => {
    const keys = (k: string) => /^(Spelunk(\[|$)|Research(\[|$))/.test(k);
    const refusal = (name: string, message: string) => row({ ci: 0, total: undefined, err: { name, message } });
    expect(classify(refusal("MissingSaveKey", "Spelunk[49]"), 33.05, keys)).toBe("refused");
    expect(classify(refusal("MissingSaveKey", "Research"), 33.05, keys)).toBe("refused");
    // a message "<key>: <more>" is refused for its key, what comes before the colon
    expect(classify(refusal("MissingSaveKey", "Spelunk[49]: more"), 33.05, keys)).toBe("refused");
    expect(classify(refusal("MissingSaveKey", "Menagerie"), 33.05, keys)).toBe("error");
    expect(classify(refusal("MissingSaveKey", "SpelunkX"), 33.05, keys)).toBe("error");
    expect(classify(refusal("MissingSaveKey", "Menagerie"), 33.05)).toBe("refused"); // no list: any key
    // Artifact Find's list: only a save older than the game's load steps lib/game replays; a key the load gives (Spelunk[49]) is a gap
    expect(classify(refusal("MissingSaveKey", UNPORTED_STEPS), 29.05, ARTIFACT_FIND_REFUSABLE)).toBe("refused");
    for (const k of ["Spelunk[49]", "Tome rows 107,108,109", "Sushi", "Menagerie"]) expect(classify(refusal("MissingSaveKey", k), 33.05, ARTIFACT_FIND_REFUSABLE), k).toBe("error");
    // Damage's list is Artifact Find's: the Tome is lib/game's own, refused for the same keys (no "Tome rows" refusal any more)
    expect(classify(refusal("MissingSaveKey", UNPORTED_STEPS), 29.05, DAMAGE_REFUSABLE)).toBe("refused");
    for (const k of ["Spelunk[49]", "Tome rows 21,101,105", "Sushi", "Menagerie"]) expect(classify(refusal("MissingSaveKey", k), 33.05, DAMAGE_REFUSABLE), k).toBe("error");
  });

  it("only MissingSaveKey is a refusal", () => {
    const old = (name: string) => row({ total: undefined, err: { name, message: "x" } });
    expect(classify(old("NotPorted"), 23.05)).toBe("error");
    expect(classify(old("TreeTotalMismatch"), 23.05)).toBe("error");
  });
});
