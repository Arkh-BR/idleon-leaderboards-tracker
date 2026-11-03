import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadReadings, readingSave, READINGS_DIR } from "@/lib/readings/registry";
import { importBundle } from "@/scripts/readings/import";
import type { Reading } from "@/lib/readings/types";

const sha1 = (b: Buffer) => createHash("sha1").update(b).digest("hex");

describe("readings registry", () => {
  it("loadReadings returns the seeded readings with unique ids", () => {
    const rs = loadReadings();
    expect(rs.length).toBeGreaterThan(0);
    expect(new Set(rs.map((r) => r.id)).size).toBe(rs.length);
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
