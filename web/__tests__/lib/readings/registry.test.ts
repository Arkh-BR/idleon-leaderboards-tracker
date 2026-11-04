import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReadings, readingSave, readingValues, READINGS_DIR, READINGS_INDEX } from "@/lib/readings/registry";
import { importBundle } from "@/scripts/readings/import";
import type { Reading } from "@/lib/readings/types";

const sha1 = (b: Buffer) => createHash("sha1").update(b).digest("hex");

describe("readings registry", () => {
  it("loadReadings returns the seeded readings with unique ids", () => {
    const rs = loadReadings();
    expect(rs.length).toBeGreaterThan(0);
    expect(new Set(rs.map((r) => r.id)).size).toBe(rs.length);
  });

  it("readingValues is the main stat plus every extra, keyed by StatKey", () => {
    const r = { stat: "damage", game: "a~b", extra: { maxHp: "1T", str: "9" } } as unknown as Reading;
    expect(readingValues(r)).toEqual([
      { stat: "damage", game: "a~b" },
      { stat: "maxHp", game: "1T" },
      { stat: "str", game: "9" },
    ]);
    expect(readingValues({ stat: "tomeScore", game: "7" } as Reading)).toEqual([{ stat: "tomeScore", game: "7" }]);
  });

  it("a seeded knownGaps entry names a stat the reading has a value for", () => {
    for (const r of loadReadings()) {
      const stats = readingValues(r).map((v) => v.stat);
      for (const g of r.knownGaps ?? []) expect(stats, `${r.id}: knownGaps ${g}`).toContain(g);
    }
    expect(loadReadings().find((r) => r.id === "2026-11-03-damage-farkhe")?.knownGaps).toEqual(["damage"]);
  });

  it("the paths are absolute and inside web/, wherever the process runs from", () => {
    const web = resolve(fileURLToPath(import.meta.url), "../../../..");
    for (const p of [READINGS_DIR, READINGS_INDEX]) {
      expect(isAbsolute(p)).toBe(true);
      expect(relative(web, p).startsWith("..")).toBe(false);
    }
    expect(resolve(READINGS_INDEX)).toBe(join(web, "fixtures", "readings.json"));
    expect(resolve(READINGS_DIR)).toBe(join(web, "scripts", "updater", "golden", ".cache", "readings"));
  });

  it("readingSave returns null when the save file is missing", () => {
    const r = { saveFile: "no-such-reading.json" } as Reading;
    expect(readingSave(r)).toBeNull();
  });

  it("import writes envelope + metadata, and is idempotent", () => {
    const tmp = mkdtempSync(join(tmpdir(), "readings-"));
    try {
      const dir = join(tmp, "saves");
      const index = join(tmp, "readings.json");
      const reading = {
        id: "t-damage", stat: "damage" as const, charIdx: 3, charName: "x", map: 150,
        capturedAt: "2026-11-03T00:00:00.000Z", game: "💎1₸~2₸", extra: { maxHp: "1T" },
      };
      const envelope = { data: { a: 1 }, lastUpdated: 1 };

      importBundle({ reading, envelope }, dir, index);
      const r = importBundle({ reading, envelope }, dir, index);

      const all = JSON.parse(readFileSync(index, "utf8")) as Reading[];
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(r);
      expect(r.saveFile).toBe("t-damage.json");
      expect(r.saveSha1).toBe(sha1(readFileSync(join(dir, r.saveFile))));
      expect(readingSave(r, dir)).toEqual(envelope);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("a re-import keeps the knownGaps of the existing entry unless the bundle names its own", () => {
    const tmp = mkdtempSync(join(tmpdir(), "readings-"));
    try {
      const dir = join(tmp, "saves");
      const index = join(tmp, "readings.json");
      const reading = {
        id: "t-gap", stat: "damage" as const, charIdx: 0, charName: "x", map: 1,
        capturedAt: "2026-11-03T00:00:00.000Z", game: "1",
      };
      const envelope = { data: {} };
      importBundle({ reading: { ...reading, knownGaps: ["damage" as const] }, envelope }, dir, index);
      expect(importBundle({ reading, envelope }, dir, index).knownGaps).toEqual(["damage"]); // the form never sends it
      expect(loadReadings(index)[0].knownGaps).toEqual(["damage"]);
      expect(importBundle({ reading: { ...reading, knownGaps: [] }, envelope }, dir, index).knownGaps).toEqual([]); // the bundle wins
      expect(importBundle({ reading: { ...reading, id: "t-new" }, envelope }, dir, index).knownGaps).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("import refuses an envelope with keys outside the save envelope", () => {
    const tmp = mkdtempSync(join(tmpdir(), "readings-"));
    try {
      const reading = { id: "t", stat: "damage" as const, charIdx: 0, charName: "x", map: 0, capturedAt: "", game: "" };
      for (const extra of ["refreshToken", "gameAuth.session.v1"]) {
        expect(() =>
          importBundle({ reading, envelope: { data: {}, [extra]: "secret" } }, join(tmp, "s"), join(tmp, "i.json")),
        ).toThrow(/outside the save envelope/);
      }
      expect(existsSync(join(tmp, "s"))).toBe(false); // refused before anything is written
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  // Private saves are gitignored: skips (proves nothing) where they are absent.
  describe.skipIf(!existsSync(READINGS_DIR))("seeded saves", () => {
    for (const r of loadReadings()) {
      it.skipIf(!existsSync(join(READINGS_DIR, r.saveFile)))(`${r.id}: file matches saveSha1`, () => {
        expect(sha1(readFileSync(join(READINGS_DIR, r.saveFile)))).toBe(r.saveSha1);
      });
    }
  });
});
