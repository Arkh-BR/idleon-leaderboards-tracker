import { describe, it, expect } from "vitest";
import { AFK_PAGE, afkGainsModel, formatAfkGains } from "@/lib/afkGains/pageConfig";
import { AFK_NODES, AFK_ROOT, AFK_VOTE_NAME, afkRate } from "@/lib/afkGains/layers";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";

describe("AFK Gains page config", () => {
  it("uses its own storage keys and the % unit", () => {
    expect(AFK_PAGE.storage).toEqual({
      save: "afk-gains-tracker.last-upload.v1",
      name: "afk-gains-tracker.playerName",
      snapshots: "afk-gains-tracker.v1",
      collapse: "afk-gains.snapshot-section.collapsed.v1",
      exportPrefix: "afk-gains-snapshots",
      exportLabel: "afk-gains-tracker",
    });
    expect(AFK_PAGE).toMatchObject({
      statName: "AFK Gains Rate",
      gainLabel: "AFK",
      emoji: "💤",
      calculatorTitle: "AFK Gains Calculator",
      totalLabel: "AFK Gains Rate (Fighting)",
      unit: "%",
      errPrefix: "AFK gains compute failed",
    });
    expect(AFK_PAGE.formatTotal).toBe(formatAfkGains);
  });

  // N.js @3790178: ""+Math.floor(100*rate)+"%" (the kit adds the "%").
  it.each<[number, string]>([
    [422.31870591798446, "42231"],
    [549.6821378607555, "54968"],
    [84.46374118359688, "8446"],
    [0.4, "40"],
    [0.01, "1"],
    [0, "0"],
    // 100 × 0.29 is 28.999999999999996 in floats; the game's JS prints 28 too.
    [0.29, "28"],
  ])("formatAfkGains(%s) → %s", (v, s) => expect(formatAfkGains(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatAfkGains(NaN)).toBe("—"));

  it("compute passes lib/game's refusals through the page's wrapper (an older save is told in words)", async () => {
    await expect(AFK_PAGE.compute({ charNames: ["a"], data: { CSver: 23.05 } }, 0, 251)).rejects.toThrow(
      /^This save is from an older game version \(missing .+\)\. Sign in or paste a fresh save\.$/
    );
  });

  it("documents that the Observed Max comes from the same engine", () =>
    expect(AFK_PAGE.methodologyNote).toMatch(/computed by the same engine as this page/));

  it("loads the Observed Max for a class", async () => {
    const top = await AFK_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });
});

describe("AFK what-if gains model (synthetic)", () => {
  it("doesn't rank the weekly vote (Vote 6)", () => {
    const P = `${AFK_ROOT} / ${AFK_NODES.pool}`;
    const rows = afkGainsModel.sources({ [`${P} / ${AFK_VOTE_NAME}`]: 0, [`${P} / Other`]: 5 }, { [`${P} / ${AFK_VOTE_NAME}`]: 30 });
    expect(rows.map((r) => r.source)).toEqual(["Other"]);
  });

  // the page's tree: the pool (the fight sources, then the ALL ones), the two multipliers, the three rules (lib/game/trackers/afkGains.ts)
  const flatOf = (clam: number, cove: number, type: number) => {
    const pool = ([["Base fighting rate (40%)", 40], ["A", 100], ["B", 60]] as const).map(([name, val]) => ({ name, val }));
    const sum = pool.reduce((a, it) => a + it.val, 0);
    return flattenTree({
      name: AFK_ROOT,
      val: afkRate({ sum, arcane: 0, etc92: 0, clam, cove, type }),
      children: [
        { name: AFK_NODES.pool, val: sum / 100, fmt: "x", children: pool },
        { name: AFK_NODES.arcane, val: 1, fmt: "x", children: [{ name: "Arcane", val: 0 }] },
        { name: AFK_NODES.etc92, val: 1, fmt: "x", children: [{ name: "Etc 92", val: 0 }] },
        { name: AFK_NODES.clam, val: clam },
        { name: AFK_NODES.cove, val: cove },
        { name: AFK_NODES.type, val: type },
      ],
    });
  };
  const A = `${AFK_ROOT} / ${AFK_NODES.pool} / A`;

  it("ranks a pool source by the rate it would add", () => {
    const { rows } = computeGains(afkGainsModel, flatOf(1, 0, 1), { [A]: 300 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", group: AFK_NODES.pool, display: "pct", you: 100, max: 300 });
    expect(rows[0].gainPct).toBeCloseTo(100, 9); // Σ 200 → 400
  });

  it("no row while the Cove replaces the rate", () => {
    expect(computeGains(afkGainsModel, flatOf(1, 2.171, 1), { [A]: 300 }).rows).toEqual([]);
  });

  it("nothing is comparable when the target isn't a fight", () => {
    const r = computeGains(afkGainsModel, flatOf(1, 0, 0), { [A]: 300 });
    expect(r.rows).toEqual([]);
    expect(r.comparableSources).toBe(0);
  });

  it("totalFromFlat mirrors the tree", () => {
    for (const [clam, cove, type] of [[1, 0, 1], [0.2, 0, 1], [1, 2.171, 1], [1, 0, 0]]) {
      const flat = flatOf(clam, cove, type);
      expect(afkGainsModel.totalFromFlat(flat)).toBeCloseTo(flat[AFK_ROOT], 12);
    }
  });
});
