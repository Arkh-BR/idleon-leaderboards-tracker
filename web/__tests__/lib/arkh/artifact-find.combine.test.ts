import { describe, it, expect } from "vitest";
import { combineArtifactPools } from "@/lib/arkh/computeArtifactFind";
import { ARTI_GROUPS, ARTI_ROOT } from "@/lib/arkh/stats/defs/artifact-find";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: vals.reduce((a, b) => a + b, 0),
  product: 0,
});
const empty = (): Record<string, Pool> =>
  Object.fromEntries(ARTI_GROUPS.map((g) => [g.key, pool()]));

describe("Artifact Find combine (N.js Sailing BoatArtiMulti)", () => {
  it("has the additive group then M1–M23 in game order", () => {
    expect(ARTI_GROUPS).toHaveLength(24);
    expect(ARTI_GROUPS.map((g) => g.key)).toEqual([
      "a",
      ...Array.from({ length: 23 }, (_, i) => `m${String(i + 1).padStart(2, "0")}`),
    ]);
    expect(ARTI_GROUPS[0].kind).toBe("pct");
    expect(ARTI_GROUPS[0].sources).toEqual([
      "artifact3", "captain", "shiny21", "fractal3", "bribe34", "captains6",
      "arcade32", "arcade66", "bUpg55", "sticker2add", "grid109", "vault63",
    ]);
  });

  it("assigns each factor its group shape", () => {
    const kind = (n: number) => ARTI_GROUPS[n];
    for (const n of [1, 2, 6, 7, 8, 10, 11, 12, 14, 15, 16, 17, 20, 21, 22]) {
      expect(kind(n).kind).toBe("pct");
    }
    expect(kind(18).kind).toBe("raw");
    for (const n of [4, 5, 9, 19, 23]) {
      expect(kind(n)).toMatchObject({ kind: "mult", max1: true });
    }
    for (const n of [3, 13]) {
      expect(kind(n).kind).toBe("mult");
      expect(kind(n).max1).toBeUndefined();
    }
  });

  it("an empty save multiplies to 1", () => {
    const r = combineArtifactPools(empty());
    expect(r.total).toBe(1);
    expect(r.tree.name).toBe(ARTI_ROOT);
    expect(r.tree.children).toHaveLength(24);
  });

  it("the additive group is 1 + Σ/100", () => {
    expect(combineArtifactPools({ ...empty(), a: pool(100) }).total).toBe(2);
    expect(combineArtifactPools({ ...empty(), a: pool(60, 40) }).total).toBe(2);
  });

  it("a max1 mult group floors at 1, a plain one does not", () => {
    // M4 (Companion 154) is max1: a source of 0.5 contributes 1.
    expect(combineArtifactPools({ ...empty(), m04: pool(0.5) }).total).toBe(1);
    expect(combineArtifactPools({ ...empty(), m04: pool(1.5) }).total).toBe(1.5);
    // M3 (Nightmariner) is plain: its source is a factor on its own.
    expect(combineArtifactPools({ ...empty(), m03: pool(3) }).total).toBe(3);
  });

  it("multiplies every group factor and keeps the items", () => {
    const p = empty();
    p.a = pool(100); // 2
    p.m01 = pool(15); // pct → 1.15
    p.m13 = pool(2.5); // mult → 2.5
    p.m18 = pool(0.5); // raw → 1.5
    p.m23 = pool(1.02 ** 10); // mult max1
    const r = combineArtifactPools(p);
    expect(r.total).toBeCloseTo(2 * 1.15 * 2.5 * 1.5 * 1.02 ** 10, 9);
    expect(r.tree.children![1]).toMatchObject({ name: ARTI_GROUPS[1].name, val: 1.15, fmt: "x" });
    expect(r.tree.children![1].children).toHaveLength(1);
  });
});
