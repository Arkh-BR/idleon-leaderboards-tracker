import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARTIFACT_FIND_REFUSABLE, characterize, classify, type Row } from "@/lib/diagnose/characterize";
import { IncompleteTome, MissingSaveKey, UNPORTED_STEPS } from "@/lib/game/errors";
import type { StatResult } from "@/lib/statTracker/config";

// Synthetic saves: two characters each, the "total" is read straight off the data so the fake engines are one line.
let dir: string;
const file = (name: string, data: object, chars = 2) => {
  const p = join(dir, name);
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

const result = (total: number): StatResult => ({ total, tree: { name: "t", val: total, fmt: "x" } });
// v + character index: every (save, ci) has its own number
const engine = (bias = (_s: number, _ci: number) => 0) => (save: unknown, ci: number) => {
  const v = (save as { data: { v: number } }).data.v;
  return result(v + ci + bias(v, ci));
};

describe("characterize", () => {
  it("has one row per (save, character) pair that differs, and none when the engines agree", () => {
    const same = characterize([A, B, ONE], engine(), engine());
    expect(same.rows).toEqual([]);
    expect(same.pairs).toBe(5); // A: 2, B: 2, One: 1

    const diff = characterize([A, B, ONE], engine(), engine((v, ci) => (v === 20 && ci === 1 ? 2.1 : 0)));
    expect(diff.rows).toHaveLength(1);
    expect(diff.rows[0]).toMatchObject({ save: B, ci: 1, a: 21, b: 23.1 });
    expect(diff.rows[0].rel).toBeCloseTo(2.1 / 23.1, 12);
    expect(diff.rows[0].errA).toBeUndefined();
    expect(diff.rows[0].errB).toBeUndefined();
  });

  it("ignores a relative difference of 1e-9 or less, and reports a bigger one", () => {
    const tiny = characterize([B], engine(), engine((v) => v * 1e-10));
    expect(tiny.rows).toEqual([]);
    const big = characterize([B], engine(), engine((v) => v * 1e-8));
    expect(big.rows.map((r) => r.ci)).toEqual([0, 1]);
  });

  it("a row for an engine that throws names the error class and message", () => {
    const boom = (save: unknown, ci: number) => {
      if ((save as { data: { v: number } }).data.v === 10 && ci === 1) throw new MissingSaveKey("Menagerie");
      return result(1);
    };
    const { rows } = characterize([A, B], (_s, _ci) => result(1), boom);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ save: A, ci: 1, a: 1, errB: { name: "MissingSaveKey", message: "Menagerie" } });
    expect(rows[0].b).toBeUndefined();
    expect(rows[0].errA).toBeUndefined();
    expect(rows[0].error).toBe("b threw MissingSaveKey: Menagerie");
  });

  it("an engine that throws on both sides is one row with both errors", () => {
    const { rows } = characterize([ONE], () => { throw new Error("x"); }, () => { throw new TypeError("y"); });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ errA: { name: "Error", message: "x" }, errB: { name: "TypeError", message: "y" } });
    expect(rows[0].error).toBe("a threw Error: x; b threw TypeError: y");
  });

  it("a non-finite number never equals a finite one", () => {
    expect(characterize([ONE], engine(), () => result(Number.NaN)).rows).toHaveLength(1);
    expect(characterize([ONE], () => result(Infinity), () => result(Infinity)).rows).toEqual([]);
  });

  it("times each engine over all pairs", () => {
    const spin = (ms: number) => (save: unknown, ci: number) => {
      const t = performance.now();
      while (performance.now() - t < ms);
      return engine()(save, ci);
    };
    const out = characterize([A, B, ONE], spin(2), spin(0));
    expect(out.msA).toBeGreaterThanOrEqual(5 * 2);
    expect(out.msB).toBeLessThan(out.msA);
  });

  it("gives each engine its own parse of the save (one engine writing into it cannot change the other's answer)", () => {
    const writer = (save: unknown) => {
      (save as { data: { v: number } }).data.v = 99;
      return result(99);
    };
    const { rows } = characterize([ONE], writer, engine());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ a: 99, b: 5 });
  });

  it("a save that is not an envelope is an error, not a skipped file", () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify({ nope: 1 }));
    expect(() => characterize([bad], engine(), engine())).toThrow(/bad\.json/);
  });
});

describe("classify", () => {
  const row = (over: Partial<Row>): Row => ({ save: join("x", "folder", "Koweabooo.json"), ci: 10, a: 1.21, b: 1.16, rel: 0.04, ...over });
  const KNOWN = [{ save: "Koweabooo.json", ci: 10 }, { save: "Tome.json" }];

  it("is known when the diff list names the save's file name and character", () => {
    expect(classify(row({}), KNOWN, 34.05)).toBe("known");
    expect(classify(row({ ci: 9 }), KNOWN, 34.05)).toBe("unexplained"); // another character of the same save
    expect(classify(row({ save: "Other.json" }), KNOWN, 34.05)).toBe("unexplained");
  });

  it("an entry without a character covers every character; the path's folders do not matter (either separator)", () => {
    expect(classify(row({ save: "C:\\saves\\fresh\\Tome.json", ci: 3 }), KNOWN, 34.05)).toBe("known");
    expect(classify(row({ save: "/a/b/Tome.json", ci: 0 }), KNOWN, 34.05)).toBe("known");
  });

  it("a diff-list entry never covers an error row", () => {
    const err = { name: "TypeError", message: "x" };
    expect(classify(row({ b: undefined, rel: undefined, errB: err }), KNOWN, 34.05)).toBe("unexplained");
  });

  it("is refused when lib/game throws MissingSaveKey (or IncompleteTome) on a save below CSver 34.05", () => {
    const missing = { name: "MissingSaveKey", message: "Menagerie" };
    const tome = { name: "IncompleteTome", message: "Tome rows 107" };
    for (const err of [missing, tome]) {
      const r = row({ ci: 0, b: undefined, rel: undefined, errB: err });
      expect(classify(r, [], 34.04)).toBe("refused");
      expect(classify(r, [], 23.05)).toBe("refused");
      expect(classify(r, [], 34.05)).toBe("unexplained"); // a current save that lacks a key is a bug, not a pre-migration save
      expect(classify(r, [], undefined)).toBe("unexplained");
    }
    // the same classes as the real errors (their name is what the row carries)
    expect(new MissingSaveKey("k").name).toBe("MissingSaveKey");
    expect(new IncompleteTome([]).name).toBe("IncompleteTome");
  });

  it("with a list of keys a stat may be refused for, a refusal for any other key is unexplained", () => {
    const keys = (k: string) => /^(Tome rows |Spelunk(\[|$)|Research(\[|$))/.test(k);
    const refusal = (name: string, message: string) => row({ ci: 0, b: undefined, rel: undefined, errB: { name, message } });
    expect(classify(refusal("MissingSaveKey", "Spelunk[49]"), [], 33.05, keys)).toBe("refused");
    expect(classify(refusal("MissingSaveKey", "Research"), [], 33.05, keys)).toBe("refused");
    // IncompleteTome's message is "<key>: <what each row looked for>"; the key is what comes before the colon
    expect(classify(refusal("IncompleteTome", "Tome rows 107,108: #107 \"x\" (y)"), [], 33.05, keys)).toBe("refused");
    expect(classify(refusal("MissingSaveKey", "Menagerie"), [], 33.05, keys)).toBe("unexplained");
    expect(classify(refusal("MissingSaveKey", "SpelunkX"), [], 33.05, keys)).toBe("unexplained");
    expect(classify(refusal("MissingSaveKey", "Menagerie"), [], 33.05)).toBe("refused"); // no list: any key
    // Artifact Find's list: only a save older than the game's load steps lib/game replays; a key the load gives (Spelunk[49]) is a gap
    expect(classify(refusal("MissingSaveKey", UNPORTED_STEPS), [], 29.05, ARTIFACT_FIND_REFUSABLE)).toBe("refused");
    for (const k of ["Spelunk[49]", "Tome rows 107,108,109", "Sushi", "Menagerie"]) expect(classify(refusal("MissingSaveKey", k), [], 33.05, ARTIFACT_FIND_REFUSABLE), k).toBe("unexplained");
  });

  it("only MissingSaveKey on the lib/game side is a refusal", () => {
    const old = (err: Row["errB"], errA?: Row["errA"]) => row({ b: undefined, rel: undefined, errA, errB: err });
    expect(classify(old({ name: "NotPorted", message: "x" }), [], 23.05)).toBe("unexplained");
    expect(classify(old({ name: "TreeTotalMismatch", message: "x" }), [], 23.05)).toBe("unexplained");
    // it is lib/arkh's own refusal (the `a` side) that does not count
    expect(classify(row({ a: undefined, rel: undefined, b: 1, errA: { name: "MissingSaveKey", message: "k" } }), [], 23.05)).toBe("unexplained");
  });

  it("is shared when both engines throw (lib/game has no error that lib/arkh lacks)", () => {
    const both = row({ a: undefined, b: undefined, rel: undefined, errA: { name: "TypeError", message: "x" }, errB: { name: "NotPorted", message: "y" } });
    expect(classify(both, [], 34.05)).toBe("shared");
  });

  it("is unexplained when only lib/arkh throws, or the numbers differ without an entry", () => {
    expect(classify(row({ b: 1, errA: { name: "TypeError", message: "x" }, a: undefined, rel: undefined }), [], 34.05)).toBe("unexplained");
    expect(classify(row({ save: "Other.json" }), [], 34.05)).toBe("unexplained");
  });
});
