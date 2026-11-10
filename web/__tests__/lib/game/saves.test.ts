import { afterEach, describe, it, expect, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { DMG_LAYERS, DMG_MASTERY, DMG_RAT } from "@/lib/damage/layers";
import { loadReadings } from "@/lib/readings/registry";
import { GOLDEN_SAVES, gameCtx, goldenSaves } from "./support/saves";

const ARKHE = GOLDEN_SAVES.find((p) => basename(p) === "ARKHE.json");

describe.skipIf(!ARKHE)("gameCtx on a golden save", () => {
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
  afterEach(() => vi.unstubAllEnvs());

  it("lists only top-level envelopes: a charNames array and a data object", () => {
    vi.stubEnv("GOLDEN_ONLY", ""); // a GOLDEN_ONLY filter would drop the files this test writes
    const dir = mkdtempSync(join(tmpdir(), "golden-saves-"));
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

describe("Damage source ids", () => {
  it("are unique across every layer, Mastery and the arena (so the id alone keys a leaf)", () => {
    const ids = [
      ...DMG_LAYERS.flatMap((l) => l.steps.flatMap((s) => ("sources" in s ? s.sources : []))),
      ...DMG_MASTERY.sources,
      ...DMG_RAT.sources,
    ];
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the Damage readings' extras", () => {
  it("the readings fixture has Damage extras to compare", () =>
    expect(loadReadings().filter((r) => r.stat === "damage").flatMap((r) => Object.keys(r.extra ?? {})).length).toBeGreaterThan(0));
});
