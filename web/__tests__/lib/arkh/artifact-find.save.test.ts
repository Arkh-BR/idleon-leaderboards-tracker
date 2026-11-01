import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { saveData } from "@/lib/arkh/state";
import { captainsOfType6 } from "@/lib/arkh/stats/systems/w5/sailing";
import { formatArtifactFind } from "@/lib/artifactFind/format";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-11-01, captured at the moment of two Skill Info → Sailing readings
// of Markhe (#8): "160Qx" while standing on a W7 map, "167Qx" right after
// entering the W5 town (map 200). N.js only computes NONdummies[60] (the count
// of tier-6 captains) inside `if (200 == CurrentMap)`, so the first reading is
// the one without the "Captains of type 6" term and the second has it.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-11-01.json";

describe.skipIf(!existsSync(SAVE))("Artifact Find matches the in-game Skill Info (Markhe)", () => {
  const save = () => JSON.parse(readFileSync(SAVE, "utf8"));
  const idx = (s: any) => s.charNames.indexOf("Markhe");

  // The tracker follows the Skill Info outside the W5 town: tier-6 captains don't count.
  it("reads 160Qx without the tier-6 captains term (outside the W5 town)", () => {
    const s = save();
    const { total } = computeArkhArtifactFind(s, idx(s));
    expect(formatArtifactFind(total)).toBe("160Q");
    expect(total).toBeGreaterThan(159e15);
    expect(total).toBeLessThanOrEqual(160e15);
  });

  // The additive pool is the first group and the only one the term feeds, so
  // adding 25·min(30, n) back scales the total by (pool + that/100) / pool.
  it("…and 167Qx once the tier-6 captains term is added back (after the W5 town)", () => {
    const s = save();
    const { total, tree } = computeArkhArtifactFind(s, idx(s));
    const pool = tree.children![0].val;
    const n = captainsOfType6(saveData); // computeArkhArtifactFind loaded the save into the engine state
    expect(n).toBeGreaterThan(0);
    const withCaptains = (total * (pool + (25 * Math.min(30, n)) / 100)) / pool;
    expect(formatArtifactFind(withCaptains)).toBe("167Q");
  });
});
