import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFamilyReference, collectReference, mergeBest, profileFlat, renderTopFiles, runTopCollector, type Pool, type StatCollectorConfig } from "@/scripts/_shared/topStatCollector";
import { deriveGatedTalentsFor, allClassKeys } from "@/scripts/_shared/classGating";
import { applyGroupStep, groupVal } from "@/lib/statTracker/groups";
import { node } from "@/lib/dropRate/node";

const GROUPS = [
  { key: "m", name: "M", kind: "mult" as const, sources: ["t", "u"] },
  { key: "p", name: "P", kind: "pct" as const, sources: ["v"] },
];
// The product of the groups in order: each group's node holds its sources, the root holds the running total.
const combine = (pools: Record<string, Pool>) => {
  let total = 1;
  const kids = GROUPS.map((g) => {
    const items = pools[g.key]?.items ?? [];
    const vals = items.map((i) => i.val);
    total = applyGroupStep(g, vals, total);
    return node(g.name, groupVal(g, vals), items);
  });
  return { tree: node("Root", total, kids), total };
};
const cfg = {
  label: "Test Multi",
  root: "Root",
  groups: GROUPS,
  combine,
  constPrefix: "TOP_TEST",
  flatForClassFn: "topTestFlatForClass",
  scriptName: "scripts/update-top-test.ts",
} as unknown as StatCollectorConfig;
const pool = (...items: Array<[string, number]>): Pool => ({
  items: items.map(([name, val]) => ({ name, val, children: [{ name: "d", val }] })),
});

// Evaluates the generated module (types stripped) and returns its lookup function.
const evalLookup = (data: string) =>
  new Function(data.replace(/^type .*$/m, "").replace(/export /g, "").replace(/: Readonly<[^=]*?>\s*=/g, " =").replace(/\(classKey: [^)]*\): FlatMap/, "(classKey)") + "\nreturn topTestFlatForClass;")();

describe("shared Observed Max collector", () => {
  it("keeps the best value per source position", () => {
    const a = mergeBest(null, { m: pool(["X (Talent 35)", 2], ["Y", 5]), p: pool(["Z", 10]) });
    const b = mergeBest(a, { m: pool(["X (Talent 35)", 3], ["Y", 1]), p: pool(["Z", 4]) });
    expect(b.m.items.map((i) => i.val)).toEqual([3, 5]);
    expect(b.p.items.map((i) => i.val)).toEqual([10]);
  });

  it("zeroes a gated talent with the group's neutral value and drops its subtree", () => {
    const best = { m: pool(["X (Talent 35)", 3], ["Y", 5]), p: pool(["Lucky (Talent 35)", 10], ["Z", 4]) };
    const flat = profileFlat(cfg, best, [35]);
    expect(flat["Root / M / X (Talent 35)"]).toBe(1); // mult → 1
    expect(flat["Root / P / Lucky (Talent 35)"]).toBe(0); // pct → 0
    expect(flat["Root / M / X (Talent 35) / d"]).toBeUndefined();
    expect(flat["Root"]).toBeCloseTo(5 * 1.04, 12);
  });

  it("renders the generated module with the stat's names", () => {
    const { data, meta } = renderTopFiles(cfg, { beginner: { Root: 2, "Root / P": 2 } }, { "beginner:t35": { Root: 3 } }, { Maestro: ["beginner", "t35"] }, "beginner", { player: "p", char: "c", total: 9 }, 3, 20, "2026-09-24T00:00:00.000Z");
    expect(data).toContain("export const TOP_TEST_FAMILY_FLAT");
    expect(data).toContain("export const TOP_TEST_PROFILE_OVERRIDES");
    expect(data).toContain("export const TOP_TEST_CLASS_PROFILE");
    expect(data).toContain('export const TOP_TEST_DEFAULT_FAMILY = "beginner";');
    expect(data).toContain("export function topTestFlatForClass(classKey: string | null | undefined)");
    expect(meta).toContain('export const TOP_TEST_GENERATED_AT = "2026-09-24T00:00:00.000Z";');
    expect(meta).toContain("export const TOP_TEST_PLAYERS_SCANNED = 20;");
    expect(meta).toContain("export const TOP_TEST_HYPOTHETICAL_TOTAL = 3;");
  });

  it("the generated header names the rule the reference was built with", () => {
    const head = (extra: Partial<StatCollectorConfig>) => renderTopFiles({ ...cfg, ...extra }, {}, {}, {}, "warrior", null, 0, 20, "2026-11-01T00:00:00.000Z").data;
    expect(head({})).toContain("of that family's chars run");
    expect(head({ familySources: [] })).toContain("the rest from every char");
    expect(head({ perFamily: false })).toContain('ONE account-wide family ("all")');
  });

  it("the generated lookup picks the class's family, then its talent profile", () => {
    const { data } = renderTopFiles(cfg, { warrior: { Root: 4 }, mage: { Root: 7 } }, { "mage:t35": { Root: 8 } }, { Warrior: ["warrior", "base"], Wizard: ["mage", "t35"] }, "mage", null, 8, 20, "2026-10-31T00:00:00.000Z");
    const mod = evalLookup(data);
    expect(mod("Warrior").Root).toBe(4); // warrior family, no talent override
    expect(mod("Wizard").Root).toBe(8); // mage family + its t35 profile
    expect(mod(null).Root).toBe(7); // no class → default (highest) family
  });

  it("keeps each class family's best apart — no warrior STR next to an archer's AGI", () => {
    // Cash-bubble shape: one pct group with an STR-scaled and an AGI-scaled source.
    const bub = (str: number, agi: number) => ({ p: pool(["STR bubble", str], ["AGI bubble", agi]) });
    const ref = buildFamilyReference({ ...cfg, groups: [GROUPS[1]], gated: [] }, {
      warrior: mergeBest(mergeBest(null, bub(300, 20)), bub(250, 25)),
      archer: mergeBest(null, bub(15, 280)),
    });
    expect(ref.familyFlats.warrior!["Root / P / STR bubble"]).toBe(300);
    expect(ref.familyFlats.warrior!["Root / P / AGI bubble"]).toBe(25); // not the archer's 280
    expect(ref.familyFlats.archer!["Root / P / AGI bubble"]).toBe(280);
    expect(ref.classProfile.Royal_Guardian).toEqual(["warrior", "base"]);
    expect(ref.classProfile.Wind_Walker).toEqual(["archer", "base"]);
    expect(ref.classProfile.Wizard).toBeUndefined(); // no mage pools → falls back to the default family
  });

  it("gates only talents some — not all — classes have", () => {
    const all = allClassKeys().length;
    for (const g of deriveGatedTalentsFor([35, 632])) {
      expect(g.owners.size).toBeGreaterThan(0);
      expect(g.owners.size).toBeLessThan(all);
    }
    expect(deriveGatedTalentsFor([35]).map((g) => g.id)).toEqual([35]); // Lucky Charms: Maestro tab (shared with Voidwalker), not every class
    expect(deriveGatedTalentsFor([632])).toEqual([]); // star talent, every class
  });

  it("an account-wide stat (one \"all\" family, no gated talents) resolves to that flat for every class", () => {
    const ref = buildFamilyReference({ ...cfg, gated: [] }, { all: mergeBest(null, { m: pool(["Y", 5]), p: pool(["Z", 10]) }) });
    expect(ref.defaultFamily).toBe("all");
    expect(ref.classProfile).toEqual({});
    expect(ref.overrides).toEqual({});
    const { data } = renderTopFiles(cfg, ref.familyFlats, ref.overrides, ref.classProfile, ref.defaultFamily, null, ref.maxTotal, 20, "2026-11-01T00:00:00.000Z");
    expect(data).toContain('export const TOP_TEST_DEFAULT_FAMILY = "all";');
    const lookup = evalLookup(data);
    expect(lookup("Royal_Guardian").Root).toBe(ref.familyFlats.all!.Root);
    expect(lookup(null)).toEqual(ref.familyFlats.all);
  });

  describe("runTopCollector family key", () => {
    // One cached-save envelope per class (default: a warrior, class 7), one char each.
    const run = async (extra: Partial<StatCollectorConfig>, classes = [7]) => {
      const dir = mkdtempSync(join(tmpdir(), "top-collector-"));
      const saves = join(dir, "saves");
      mkdirSync(saves);
      classes.forEach((c, k) =>
        writeFileSync(join(saves, `p${k}.json`), JSON.stringify({ charNames: ["W"], data: { PVStatList_0: [0, 0, 0, 0, 1], CharacterClass_0: c } }))
      );
      const outputFile = join(dir, "top.ts");
      const metaFile = join(dir, "top.meta.ts");
      const quiet = [vi.spyOn(console, "log").mockImplementation(() => {}), vi.spyOn(process.stdout, "write").mockImplementation(() => true)];
      try {
        await runTopCollector(
          { ...cfg, focusBoard: "x", gated: [], outputFile, metaFile, computePools: () => ({ m: pool(["Y", 5]), p: pool(["Z", 10]) }), ...extra } as StatCollectorConfig,
          ["--saves-dir", saves, "--limit", String(classes.length)]
        );
        return readFileSync(outputFile, "utf8");
      } finally {
        quiet.forEach((s) => s.mockRestore());
        rmSync(dir, { recursive: true, force: true });
      }
    };

    it("perFamily: false merges every char into the \"all\" family", async () => {
      const data = await run({ perFamily: false });
      expect(data).toContain('export const TOP_TEST_DEFAULT_FAMILY = "all";');
      expect(data).toContain('"all": {');
      expect(data).not.toContain('"warrior": {');
      expect(data).toContain("export const TOP_TEST_CLASS_PROFILE: Readonly<Record<string, readonly [string, string]>> = {};");
    });

    it("default stays per class family", async () => {
      const data = await run({});
      expect(data).toContain('export const TOP_TEST_DEFAULT_FAMILY = "warrior";');
      expect(data).not.toContain('"all": {');
    });

    // A beginner (class 1) with high LUK and no gear; a warrior (class 7) with low LUK in the Corsair Uniform.
    const lukAndGear = (save: any) =>
      save.data.CharacterClass_0 === 1
        ? { m: pool(["Y", 1]), p: pool(["LUK curve", 50], ["Corsair Uniform", 0]) }
        : { m: pool(["Y", 1]), p: pool(["LUK curve", 5], ["Corsair Uniform", 157]) };

    it("familySources: a stat-scaled source stays per family, every other one takes the best across families", async () => {
      const lookup = evalLookup(await run({ computePools: lukAndGear, familySources: [{ group: "p", name: "LUK curve" }] }, [1, 7]));
      expect(lookup("Voidwalker")["Root / P / LUK curve"]).toBe(50);
      expect(lookup("Voidwalker")["Root / P / Corsair Uniform"]).toBe(157); // the warrior's gear
      expect(lookup("Royal_Guardian")["Root / P / LUK curve"]).toBe(5); // not the beginner's LUK
      expect(lookup("Royal_Guardian")["Root / P / Corsair Uniform"]).toBe(157);
    });

    it("familySources omitted keeps every source per family", async () => {
      const lookup = evalLookup(await run({ computePools: lukAndGear }, [1, 7]));
      expect(lookup("Voidwalker")["Root / P / LUK curve"]).toBe(50);
      expect(lookup("Voidwalker")["Root / P / Corsair Uniform"]).toBe(0);
    });

    it("refuses a familySources entry that names no source", async () => {
      await expect(run({ computePools: lukAndGear, familySources: [{ group: "p", name: "Renamed" }] }, [1, 7])).rejects.toThrow(/familySources/);
    });
  });

  describe("collectReference", () => {
    // Two players, one char each: a warrior (class 7) and a mage (class 31), the pools picked by the save's tag.
    const save = (klass: number, extra: object = {}) => ({ charNames: ["C"], data: { PVStatList_0: [0, 0, 0, 0, 1], CharacterClass_0: klass }, ...extra });
    const players = [
      { name: "a", save: save(7, { w: 1 }) },
      { name: "b", save: save(31, { w: 2 }) },
    ];
    const pools = (s: any) => (s.w === 1 ? { m: pool(["Y", 5], ["Q", 1]), p: pool(["Z", 10]) } : { m: pool(["Y", 2], ["Q", 9]), p: pool(["Z", 4]) });
    const full = { ...cfg, gated: [], computePools: pools } as unknown as StatCollectorConfig;

    it("gives the best per position and the family split", () => {
      const r = collectReference(full, players);
      expect(r.scanned).toBe(2);
      expect(r.refusedChars).toEqual([]);
      expect(r.best.m.items.map((i) => i.val)).toEqual([5, 9]); // best across both players, positions aligned
      expect(r.ref.familyFlats.warrior!["Root / M / Y"]).toBe(5);
      expect(r.ref.familyFlats.warrior!["Root / M / Q"]).toBe(1); // the warrior's own best
      expect(r.ref.familyFlats.mage!["Root / M / Q"]).toBe(9);
    });

    it("sends gated talents to their neutral value", () => {
      const gated = [{ id: 35, owners: new Set<string>(["Maestro"]) }];
      const cfg35 = { ...full, gated, computePools: () => ({ m: pool(["X (Talent 35)", 3], ["Y", 5]), p: pool(["Z", 4]) }) } as unknown as StatCollectorConfig;
      const r = collectReference(cfg35, players);
      expect(r.ref.familyFlats.warrior!["Root / M / X (Talent 35)"]).toBe(1);
      expect(r.ref.overrides["beginner:t35"]).toBeUndefined(); // no beginner pools: nothing to add back
      expect(r.ref.classProfile.Maestro).toBeUndefined();
    });

    it("counts and names a refusing character and keeps going", () => {
      const refusing = { ...full, computePools: (s: any) => { if (s.w === 1) throw new Error("MissingSaveKey: x"); return pools(s); } } as unknown as StatCollectorConfig;
      const r = collectReference(refusing, players);
      expect(r.refusedChars).toEqual(["a/C"]);
      expect(r.skipped).toEqual([expect.stringContaining("a")]); // every character of "a" refused → the player is skipped
      expect(r.scanned).toBe(1);
      expect(r.ref.familyFlats.mage).toBeDefined();
      expect(r.ref.familyFlats.warrior).toBeUndefined();
    });
  });
});
