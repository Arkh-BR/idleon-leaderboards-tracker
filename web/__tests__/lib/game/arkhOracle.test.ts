import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { ARTI_GROUPS } from "@/lib/arkh/stats/defs/artifact-find";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhArtifactLeaf, gameCtx } from "./support/arkhOracle";

// Spy on the engine so the cache tests can count real computes; the original still runs.
vi.mock("@/lib/arkh/computeArtifactFind", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/lib/arkh/computeArtifactFind")>();
  return { ...m, computeArkhArtifactFind: vi.fn(m.computeArkhArtifactFind) };
});

const spy = vi.mocked(computeArkhArtifactFind);

// Same lookup as the smoke test: group in ARTI_GROUPS order, then the source in `sources` order.
const leafOf = (tree: ReturnType<typeof computeArkhArtifactFind>["tree"], id: string): number => {
  const gi = ARTI_GROUPS.findIndex((g) => g.sources.includes(id));
  return tree.children![gi].children![ARTI_GROUPS[gi].sources.indexOf(id)].val;
};

// The owner's account has 9+ characters (Markhe is #8), so ci 8 exists in it.
const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");

describe.skipIf(!ARKHE)("arkhArtifactLeaf on a golden save", () => {
  it("equals the node read straight from computeArkhArtifactFind's tree", () => {
    const direct = leafOf(computeArkhArtifactFind(JSON.parse(readFileSync(ARKHE!, "utf8")), 8).tree, "vault63");
    expect(direct).toBeGreaterThan(0); // a zero would make the comparison vacuous
    expect(arkhArtifactLeaf(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, "vault63")).toBe(direct);
    expect(arkhArtifactLeaf(ARKHE, 8, "vault63")).toBe(direct);
  });

  it("leaves the caller's save untouched (the old engine writes into what it is given)", () => {
    const save = JSON.parse(readFileSync(ARKHE!, "utf8"));
    const before = JSON.stringify(save);
    arkhArtifactLeaf(save, 8, "vault63");
    expect(JSON.stringify(save)).toBe(before);
  });

  it("gameCtx builds the lib/game Ctx for a real save", () => {
    const save = JSON.parse(readFileSync(ARKHE!, "utf8"));
    const ctx = gameCtx(save, 8);
    expect(ctx.player).toBe(8);
    expect(ctx.map).toBe(0);
    expect(ctx.trace).toBeNull();
    expect(ctx.state.charNames).toEqual(save.charNames);
    expect(gameCtx(save, 8, true).trace).not.toBeNull();
  });
});

describe("GOLDEN_SAVES", () => {
  it("is sorted, made of top-level save files only", () => {
    expect([...GOLDEN_SAVES].sort()).toEqual(GOLDEN_SAVES);
    for (const p of GOLDEN_SAVES) {
      expect(p).toMatch(/\.json$/);
      expect(p).not.toMatch(/[\/]readings[\/]/); // the readings/ subfolder holds non-save captures
    }
  });
});

describe("arkhArtifactLeaf cache and errors", () => {
  const env = (): any => ({ charNames: ["A", "B"], data: {} });

  it("computes the tree once per (save object, ci), whatever the source", () => {
    spy.mockClear();
    const save = env();
    arkhArtifactLeaf(save, 0, "vault63");
    arkhArtifactLeaf(save, 0, "grid109");
    arkhArtifactLeaf(save, 0, "nightmariner");
    expect(spy).toHaveBeenCalledTimes(1);
    arkhArtifactLeaf(save, 1, "vault63"); // another character is another tree
    expect(spy).toHaveBeenCalledTimes(2);
    arkhArtifactLeaf(env(), 0, "vault63"); // another object too
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("computes the tree once per (save path, ci), parsing the file only then", () => {
    const dir = mkdtempSync(join(tmpdir(), "arkh-oracle-"));
    try {
      const path = join(dir, "save.json");
      writeFileSync(path, JSON.stringify(env()));
      spy.mockClear();
      const a = arkhArtifactLeaf(path, 0, "vault63");
      expect(arkhArtifactLeaf(path, 0, "grid109")).toBe(arkhArtifactLeaf(path, 0, "grid109"));
      expect(arkhArtifactLeaf(path, 0, "vault63")).toBe(a);
      expect(spy).toHaveBeenCalledTimes(1);
      arkhArtifactLeaf(path, 1, "vault63");
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads a node of the additive pool and one of a later group", () => {
    const save = { charNames: ["A"], data: { Captains: JSON.stringify([[6, 0, 0, 0, 0, 0, 0], [6, 0, 0, 0, 0, 0, 0]]) } };
    expect(arkhArtifactLeaf(save, 0, "captains6")).toBe(50); // +25 per type-6 captain
    expect(arkhArtifactLeaf(save, 0, "starSign61")).toBe(0); // an m01 group: not the additive pool
  });

  it("throws on a source id that is not in ARTI_GROUPS", () => {
    expect(() => arkhArtifactLeaf(env(), 0, "nope")).toThrow(/nope/);
  });
});

describe("KNOWN_ARKH_DIFFS", () => {
  it("starts empty", () => {
    expect(KNOWN_ARKH_DIFFS).toEqual([]);
  });
});
