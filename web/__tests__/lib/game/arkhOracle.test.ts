import { afterEach, describe, it, expect, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { ARTI_GROUPS } from "@/lib/arkh/stats/defs/artifact-find";
import { applyGroupStep, groupVal } from "@/lib/arkh/stats/defs/grouped";
import { DMG_LAYERS, DMG_MASTERY, DMG_RAT, dmgLayer } from "@/lib/arkh/stats/defs/damage";
import { computeArkhDamage, DMG_COLLECTOR_MAP } from "@/lib/arkh/computeDamage";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { AFK_POOLS } from "@/lib/arkh/stats/defs/afk-gains";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import { DR2_GROUPS } from "@/lib/arkh/stats/defs/drop-rate-v2";
import { medallionList } from "@/lib/arkh/stats/systems/exp/medallions";
import { MapAFKtarget } from "@/lib/arkh/stats/data/game/customlists.js";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { formatGameValue } from "@/lib/readings/format";
import { READINGS_DIR, loadReadings, readingSave } from "@/lib/readings/registry";
import { GOLDEN_SAVES, KNOWN_ARKH_DIFFS, arkhArtifactLeaf, arkhDamage, arkhDamagePoolKeys, arkhDamageLeaf, arkhDamageLeaves, arkhAfkLeaves, arkhAfkRate, arkhExpLeaves, arkhExpMulti, arkhDrLeaves, arkhDropRate, arkhSourceHash, arkhStat, arkhStats, gameCtx, goldenSaves, setArkhSourceHash, setOracleCacheDir, type ArkhStat } from "./support/arkhOracle";

// Spy on the engine so the cache tests can count real computes; the original still runs.
vi.mock("@/lib/arkh/computeArtifactFind", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/lib/arkh/computeArtifactFind")>();
  return { ...m, computeArkhArtifactFind: vi.fn(m.computeArkhArtifactFind) };
});

vi.mock("@/lib/arkh/computeDamage", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/lib/arkh/computeDamage")>();
  return { ...m, computeArkhDamage: vi.fn(m.computeArkhDamage) };
});

const spy = vi.mocked(computeArkhArtifactFind);
const dmgSpy = vi.mocked(computeArkhDamage);

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

  // Pins the group/index slot of EVERY source id, not only the additive pool's: rebuild each group's
  // factor and the total from the leaves alone, the way lib/arkh combines them (its own groupVal and
  // applyGroupStep), and compare with lib/arkh's tree. A source read from the wrong slot gives another
  // factor; the per-group check also catches two same-kind groups swapped, which leaves the product alone.
  it("every ARTI_GROUPS source reads its own slot (leaves recombine to lib/arkh's groups and total)", () => {
    const { tree, total } = computeArkhArtifactFind(JSON.parse(readFileSync(ARKHE!, "utf8")), 8);
    const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
    let rebuilt = 1;
    ARTI_GROUPS.forEach((grp, gi) => {
      const leaves = grp.sources.map((id) => arkhArtifactLeaf(ARKHE, 8, id));
      expect(rel(groupVal(grp, leaves), tree.children![gi].val), grp.key).toBeLessThan(1e-9);
      rebuilt = applyGroupStep(grp, leaves, rebuilt);
    });
    expect(total).toBeGreaterThan(1); // an all-neutral save would match by accident
    expect(rel(rebuilt, total)).toBeLessThan(1e-9);
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
      expect(p).not.toMatch(/[\\/]readings[\\/]/); // the readings/ subfolder holds non-save captures
    }
  });
});

describe("goldenSaves", () => {
  it("lists only top-level envelopes: a charNames array and a data object", () => {
    const dir = mkdtempSync(join(tmpdir(), "arkh-golden-"));
    try {
      const envelope = JSON.stringify({ charNames: ["A"], data: {} });
      writeFileSync(join(dir, "b-save.json"), envelope);
      writeFileSync(join(dir, "a-save.json"), envelope);
      writeFileSync(join(dir, "stray.json"), JSON.stringify({ hello: "world" }));
      writeFileSync(join(dir, "no-chars.json"), JSON.stringify({ data: {} }));
      writeFileSync(join(dir, "chars-not-array.json"), JSON.stringify({ charNames: "A", data: {} }));
      writeFileSync(join(dir, "data-null.json"), JSON.stringify({ charNames: ["A"], data: null }));
      writeFileSync(join(dir, "broken.json"), "{ not json");
      writeFileSync(join(dir, "notes.txt"), envelope);
      mkdirSync(join(dir, "readings"));
      writeFileSync(join(dir, "readings", "nested.json"), envelope);
      expect(goldenSaves([dir, join(dir, "absent")]).map((p) => basename(p))).toEqual(["a-save.json", "b-save.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
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
  it("every entry names a real source and cites its N.js evidence (an @offset)", () => {
    const arti = new Set(ARTI_GROUPS.flatMap((g) => g.sources));
    const dmg = new Set(dmgIds());
    const afk = new Set(AFK_POOLS.flatMap((g) => g.sources)); // the leaves of AFKgainrates("Fighting"): the Σ pool, the multipliers and the rules
    for (const d of KNOWN_ARKH_DIFFS) {
      const stat = d.stat ?? "artifactFind"; // absent = Artifact Find
      if (stat === "artifactFind") expect(arti.has(d.source), d.source).toBe(true);
      else if (stat === "damage") expect(dmg.has(d.source), d.source).toBe(true);
      else if (stat === "afk") expect(afk.has(d.source), d.source).toBe(true);
      expect(d.save).toMatch(/\.json$/);
      expect(d.why).toMatch(/@\d+/);
    }
  });
});

function dmgIds(): string[] {
  return [
    ...DMG_LAYERS.flatMap((l) => l.steps.flatMap((s) => ("sources" in s ? s.sources : []))),
    ...DMG_MASTERY.sources,
    ...DMG_RAT.sources,
  ];
}

describe("Damage source ids", () => {
  it("the pool keys arkhDamage recombines are unique too", () => {
    const keys = arkhDamagePoolKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("are unique across every layer, Mastery and the arena (so the id alone keys a leaf)", () => {
    const ids = dmgIds();
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("arkhDamageLeaf and arkhStat", () => {
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

  it("throws on an id that is not a Damage source", () => {
    expect(() => arkhDamageLeaf({ charNames: ["A"], data: {} }, 0, DMG_COLLECTOR_MAP, "nope")).toThrow(/nope/);
  });

  describe.skipIf(!ARKHE)("on ARKHE ci 8, map 251", () => {
    it("the leaves recombine, layer by layer, to lib/arkh's layers and Max", () => {
      const { tree, total } = computeArkhDamage(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, DMG_COLLECTOR_MAP);
      const leaves = arkhDamageLeaves(ARKHE, 8, DMG_COLLECTOR_MAP);
      let max = 1;
      DMG_LAYERS.forEach((layer, i) => {
        // look the step up in THIS layer (a step key could repeat across layers)
        const valsOf = (key: string) => {
          const s = layer.steps.find((x) => x.key === key);
          return s && "sources" in s ? s.sources.map((id) => leaves[id]) : [];
        };
        const v = dmgLayer(layer, valsOf).val;
        expect(rel(v, tree.children![i].val), layer.key).toBeLessThan(1e-9); // a swapped step breaks its layer
        max *= v;
      });
      expect(total).toBeGreaterThan(1);
      expect(rel(max, total)).toBeLessThan(1e-9);
      expect(DMG_RAT.sources.map((id) => arkhDamageLeaf(ARKHE, 8, DMG_COLLECTOR_MAP, id))).toEqual([0]); // map 251: arena off
      expect(DMG_MASTERY.sources.map((id) => arkhDamageLeaf(ARKHE, 8, DMG_COLLECTOR_MAP, id)).some((v) => v !== 0)).toBe(true);
    });

    // arkhDamage recombines the cached leaves with lib/arkh's own dmgMax / dmgMastery: it must be what computeArkhDamage itself returns,
    // on a plain map, on the arena (the rat replaces Max, Mastery is .2) and on the Clamworks
    it("arkhDamage is computeArkhDamage's total and Mastery node, on maps 251, 43 and 306", () => {
      for (const map of [DMG_COLLECTOR_MAP, 43, 306]) {
        const { tree, total } = computeArkhDamage(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, map);
        const mastery = tree.children!.find((c) => c.name === "Mastery (Min)")!.val;
        const got = arkhDamage(ARKHE, 8, map);
        expect(total, `map ${map}`).toBeGreaterThan(1);
        expect(rel(got.max, total), `map ${map}`).toBeLessThan(1e-12);
        expect(got.mastery, `map ${map}`).toBe(mastery);
      }
      expect(arkhDamage(ARKHE, 8, 43).mastery).toBe(0.2);
    });

    it("leaves the caller's save untouched", () => {
      const save = JSON.parse(readFileSync(ARKHE!, "utf8"));
      const before = JSON.stringify(save);
      arkhDamageLeaf(save, 8, DMG_COLLECTOR_MAP, "wpSquared");
      arkhStat(save, 8, "str");
      expect(JSON.stringify(save)).toBe(before);
    });
  });

  // The Damage readings' extras: arkhStat shows what the game showed (the readings test ran these on lib/arkh until the Damage page moved
  // to lib/game; the oracle keeps lib/arkh's own check against the game's text).
  const rows = loadReadings()
    .filter((r) => r.stat === "damage")
    .flatMap((r) => Object.entries(r.extra ?? {}).map(([stat, game]) => ({ r, stat: stat as ArkhStat, game })));
  it("the readings fixture has Damage extras to compare", () => expect(rows.length).toBeGreaterThan(0));
  for (const { r, stat, game } of rows) {
    // collection time: only a file-exists check; the save is parsed inside the test
    it.skipIf(!existsSync(join(READINGS_DIR, r.saveFile)))(`${r.id} ${stat}: arkhStat = the game's ${game}`, () => {
      expect(formatGameValue(stat, { value: arkhStat(readingSave(r), r.charIdx, stat) })).toBe(game);
    });
  }
});

describe("the disk cache of arkhDamageLeaves / arkhStats", () => {
  const dirs: string[] = [];
  const fresh = () => {
    const d = mkdtempSync(join(tmpdir(), "arkh-oracle-cache-"));
    dirs.push(d);
    setOracleCacheDir(d);
    return d;
  };
  const savePath = (dir: string, name = "s.json") => {
    const p = join(dir, name);
    writeFileSync(p, JSON.stringify({ charNames: ["A"], data: { Captains: "[]" } }));
    return p;
  };
  afterEach(() => {
    setArkhSourceHash(undefined);
    setOracleCacheDir(null);
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it("a miss computes once and writes the file; a later process (cleared memory) hits without computing", () => {
    const cache = fresh();
    const p = savePath(mkdtempSync(join(tmpdir(), "arkh-oracle-sav-")));
    dirs.push(join(p, ".."));
    dmgSpy.mockClear();
    const first = arkhDamageLeaves(p, 0, 251);
    arkhStats(p, 0); // same entry: no second compute
    expect(dmgSpy).toHaveBeenCalledTimes(1);
    expect(readdirSync(cache)).toHaveLength(1);
    setOracleCacheDir(cache); // drops the in-memory copy: what a new run sees
    dmgSpy.mockClear();
    expect(arkhDamageLeaves(p, 0, 251)).toEqual(first);
    expect(arkhStats(p, 0).str).toBe(arkhStat(p, 0, "str"));
    expect(dmgSpy).not.toHaveBeenCalled();
  });

  it("a changed lib/arkh hash is a miss", () => {
    const cache = fresh();
    const p = savePath(mkdtempSync(join(tmpdir(), "arkh-oracle-sav-")));
    dirs.push(join(p, ".."));
    arkhDamageLeaves(p, 0, 251);
    setArkhSourceHash("0".repeat(40));
    dmgSpy.mockClear();
    arkhDamageLeaves(p, 0, 251);
    expect(dmgSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(join(cache, readdirSync(cache)[0]), "utf8")).arkhHash).toBe("0".repeat(40));
  });

  it("the source hash is a sha1 of lib/arkh's files and is stable", () => {
    setArkhSourceHash(undefined);
    expect(arkhSourceHash()).toMatch(/^[0-9a-f]{40}$/);
    expect(arkhSourceHash()).toBe(arkhSourceHash());
  });

  it("an object save is memory-only: nothing is written", () => {
    const cache = fresh();
    arkhDamageLeaves({ charNames: ["A"], data: {} }, 0, 251);
    expect(readdirSync(cache)).toHaveLength(0);
  });

  describe.skipIf(!ARKHE)("on ARKHE", () => {
    it("leaves read back from the disk equal a fresh compute", () => {
      fresh();
      const fromCompute = arkhDamageLeaves(ARKHE, 8, 251); // miss: computed, written
      const stats = arkhStats(ARKHE, 8);
      setOracleCacheDir(dirs[0]); // clear memory, keep the folder
      dmgSpy.mockClear();
      expect(arkhDamageLeaves(ARKHE, 8, 251)).toEqual(fromCompute);
      expect(arkhStats(ARKHE, 8)).toEqual(stats);
      expect(dmgSpy).not.toHaveBeenCalled();
      const direct = computeArkhDamage(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, 251).tree;
      expect(fromCompute.wpSquared).toBe(direct.children![0].children![0].children![0].val);
    });
  });
});

describe.skipIf(!ARKHE)("arkhAfkLeaves / arkhAfkRate", () => {
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
  const ids = AFK_POOLS.flatMap((g) => g.sources);

  it.each([251, 306, 216])("ARKHE ci 8 map %i: the leaves rebuild lib/arkh's total", (map) => {
    const direct = computeArkhAfkGains(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, map).total;
    const leaves = arkhAfkLeaves(ARKHE, 8, map);
    expect(Object.keys(leaves).sort()).toEqual([...ids].sort());
    expect(rel(arkhAfkRate(ARKHE, 8, map), direct)).toBeLessThan(1e-9);
    if (map === 251) expect(arkhAfkRate(ARKHE, 8, map)).toBeGreaterThan(0); // 216 is 0 outside the Cove (not a fight): a vacuous check there
  });

  it("an object save gives the same leaves and is left untouched", () => {
    const save = JSON.parse(readFileSync(ARKHE!, "utf8"));
    const before = JSON.stringify(save);
    expect(arkhAfkLeaves(save, 8, 251)).toEqual(arkhAfkLeaves(ARKHE, 8, 251));
    expect(JSON.stringify(save)).toBe(before);
  });

  it("every golden save, first and last character, on map 251 rebuilds lib/arkh's total", () => {
    for (const p of GOLDEN_SAVES) {
      const n = JSON.parse(readFileSync(p, "utf8")).charNames.length;
      // ponytail: first and last character only; a full sweep recomputes lib/arkh 5 times (about 95 s)
      for (const ci of new Set([0, n - 1])) {
        const direct = computeArkhAfkGains(JSON.parse(readFileSync(p, "utf8")), ci, 251).total;
        expect(rel(arkhAfkRate(p, ci, 251), direct), `${basename(p)}#${ci}`).toBeLessThan(1e-9);
      }
    }
  }, 900_000);
});

describe.skipIf(!ARKHE)("arkhExpLeaves / arkhExpMulti", () => {
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
  const ids = EXP_GROUPS.flatMap((g) => g.sources);
  // the groups recombined from the leaves, as groupedDescriptor does (mult / pct / max1 through applyGroupStep)
  const recombine = (l: Record<string, number>) => EXP_GROUPS.reduce((t, g) => applyGroupStep(g, g.sources.map((id) => l[id]), t), 1);
  // a map whose default monster's medallion the character owns (the Shiny Medallions term applies there)
  const medalMap = () => {
    loadSaveData(JSON.parse(readFileSync(ARKHE!, "utf8")));
    const owned = medallionList(saveData as any);
    const m = (MapAFKtarget as unknown as string[]).findIndex((t) => owned.includes(String(t)));
    if (m < 0) throw new Error("ARKHE owns no medallion for any map");
    return m;
  };

  it("ARKHE ci 8 map 251: the leaves rebuild lib/arkh's total", () => {
    const direct = computeArkhExpMulti(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, 251).total;
    const leaves = arkhExpLeaves(ARKHE, 8, 251);
    expect(Object.keys(leaves).sort()).toEqual([...ids].sort());
    expect(direct).toBeGreaterThan(1);
    expect(rel(recombine(leaves), direct)).toBeLessThan(1e-9);
    expect(arkhExpMulti(ARKHE, 8, 251)).toBe(direct);
  });

  it("ARKHE ci 8 on a medallion map: the medallion term applies and the leaves rebuild the total", () => {
    const map = medalMap();
    const direct = computeArkhExpMulti(JSON.parse(readFileSync(ARKHE!, "utf8")), 8, map).total;
    const leaves = arkhExpLeaves(ARKHE, 8, map);
    expect(leaves.medallion429, `map ${map}`).toBeGreaterThan(1);
    expect(rel(recombine(leaves), direct)).toBeLessThan(1e-9);
    expect(arkhExpMulti(ARKHE, 8, map)).toBe(direct);
  });

  it("an object save gives the same leaves and is left untouched", () => {
    const save = JSON.parse(readFileSync(ARKHE!, "utf8"));
    const before = JSON.stringify(save);
    expect(arkhExpLeaves(save, 8, 251)).toEqual(arkhExpLeaves(ARKHE, 8, 251));
    expect(arkhExpMulti(save, 8, 251)).toBe(arkhExpMulti(ARKHE, 8, 251));
    expect(JSON.stringify(save)).toBe(before);
  });

  it("every golden save, first and last character, on map 251 rebuilds lib/arkh's total", () => {
    for (const p of GOLDEN_SAVES) {
      const n = JSON.parse(readFileSync(p, "utf8")).charNames.length;
      for (const ci of new Set([0, n - 1])) {
        const direct = computeArkhExpMulti(JSON.parse(readFileSync(p, "utf8")), ci, 251).total;
        expect(rel(recombine(arkhExpLeaves(p, ci, 251)), direct), `${basename(p)}#${ci}`).toBeLessThan(1e-9);
      }
    }
  }, 900_000);
});

describe.skipIf(!ARKHE)("arkhDrLeaves / arkhDropRate", () => {
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
  const ids = DR2_GROUPS.flatMap((g) => g.sources);
  const recombine = (l: Record<string, number>) => DR2_GROUPS.reduce((t, g) => applyGroupStep(g, g.sources.map((id) => l[id]), t), 1);
  const load = () => JSON.parse(readFileSync(ARKHE!, "utf8"));

  it("ARKHE ci 8 map 251: the key set is the DR2_GROUPS source ids and the leaves rebuild lib/arkh's total", () => {
    const direct = computeArkhDropRateV2(load(), 8, 251).total;
    const leaves = arkhDrLeaves(ARKHE, 8, 251);
    expect(Object.keys(leaves).sort()).toEqual([...ids].sort());
    expect(direct).toBeGreaterThan(1);
    expect(rel(recombine(leaves), direct)).toBeLessThan(1e-9);
    expect(arkhDropRate(ARKHE, 8, 251)).toBe(direct);
  });

  it("map 216 with the character in cavern 17 (Holes[0] seeded): the Cove replaces the total and the leaves rebuild it", () => {
    const save = load();
    // the envelope's data.Holes is a JSON string or an array (parseSaveKey); a copy with Holes[0][8] = 17
    const str = typeof save.data.Holes === "string";
    const holes = str ? JSON.parse(save.data.Holes) : save.data.Holes;
    holes[0][8] = 17;
    save.data.Holes = str ? JSON.stringify(holes) : holes;
    const direct = computeArkhDropRateV2(structuredClone(save), 8, 216).total;
    const leaves = arkhDrLeaves(save, 8, 216);
    expect(leaves.cove).toBeGreaterThan(0);
    expect(direct).toBe(leaves.cove);
    expect(rel(recombine(leaves), direct)).toBeLessThan(1e-9);
    expect(arkhDropRate(save, 8, 216)).toBe(direct);
  });

  it("an object save gives the same leaves as the path and is left untouched", () => {
    const save = load();
    const before = JSON.stringify(save);
    expect(arkhDrLeaves(save, 8, 251)).toEqual(arkhDrLeaves(ARKHE, 8, 251));
    expect(JSON.stringify(save)).toBe(before);
  });
});
