import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeTome } from "@/lib/tome/compute";
import {
  enrichRows,
  gainPts,
  heroGain,
  isGated,
  rankGains,
} from "@/lib/tome/gains";

// Regression anchors over REAL player saves. The saves are private and kept
// out of git (web/.gitignore → __tests__/fixtures/tome/), so this suite skips
// gracefully when they are absent (CI, fresh clones). To run it locally, drop
// `save-28-05.json` and `save-0806.txt` into __tests__/fixtures/tome/.
//
// ⚠️ The exact pts numbers below are bound to the bundled top-player snapshot
// in lib/tome/topPlayers.ts. If the nightly scraper refreshes that snapshot,
// regenerate the expected values with `npx tsx scripts/check-tome-gains.ts
// "<save path>"` — a number drift here is NOT a regression.

const DIR = resolve(process.cwd(), "__tests__/fixtures/tome");
const SAVE_28_05 = resolve(DIR, "save-28-05.json");
const SAVE_0806 = resolve(DIR, "save-0806.txt");
const haveSaves = existsSync(SAVE_28_05) && existsSync(SAVE_0806);

function rankOf(path: string, includeGated: boolean) {
  const result = computeTome(readFileSync(path, "utf8"), {});
  const enriched = enrichRows(result.rows, {}, null);
  return {
    total: result.totalPts,
    hero: heroGain(enriched),
    ranked: rankGains(enriched, { includeGated }),
  };
}

describe.skipIf(!haveSaves)("Biggest Gains anchors (real saves)", () => {
  it("save 28-05: hero is the actionable #1 'Vault Upgrade bonus LV' (~+104)", () => {
    const { total, hero, ranked } = rankOf(SAVE_28_05, false);
    expect(total).toBe(50371);
    expect(hero?.task).toBe("Vault Upgrade bonus LV");
    // Gain is the gap-to-top invariant, exactly.
    expect(gainPts(hero!)).toBe(Math.max(0, (hero!.top!.pts as number) - (hero!.pts ?? 0)));
    expect(gainPts(hero!)).toBeGreaterThanOrEqual(102);
    expect(gainPts(hero!)).toBeLessThanOrEqual(106);
    // The actionable ranking leads with Vault, then Minehead.
    expect(ranked[0].task).toBe("Vault Upgrade bonus LV");
    expect(ranked[1].task).toBe("Minehead Opponents Defeated");
    // No gated task slips into the default (actionable-only) view.
    expect(ranked.every((r) => !isGated(r))).toBe(true);
  });

  it("save 28-05: turning gated on makes a gated task the overall #1", () => {
    const { ranked } = rankOf(SAVE_28_05, true);
    expect(isGated(ranked[0])).toBe(true);
    // The biggest overall gap is an Update-Gated task in this snapshot.
    expect([
      "Total Arcade Gold Ball Shop Upgrade LV",
      "Lava Dev Streams watched",
    ]).toContain(ranked[0].task);
  });

  it("save 0806: hero is still 'Vault Upgrade bonus LV' (~+42) — stable across saves", () => {
    const { total, hero } = rankOf(SAVE_0806, false);
    expect(total).toBe(50663);
    expect(hero?.task).toBe("Vault Upgrade bonus LV");
    expect(gainPts(hero!)).toBeGreaterThanOrEqual(40);
    expect(gainPts(hero!)).toBeLessThanOrEqual(44);
  });
});
