import { describe, it, expect } from "vitest";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { EXP_GROUPS, EXP_ROOT, EXP_VOTE_NAME } from "@/lib/arkh/stats/defs/exp-multi";
import { EXP_CIRCUMSTANTIAL_SOURCE_NAMES } from "@/lib/arkh/stats/systems/exp/exp";

describe("EXP Multi page config", () => {
  it("uses its own storage keys", () => {
    expect(EXP_PAGE.storage).toMatchObject({
      save: "exp-multi-tracker.last-upload.v1",
      name: "exp-multi-tracker.playerName",
      snapshots: "exp-multi-tracker.v1",
      collapse: "exp-multi.snapshot-section.collapsed.v1",
    });
    expect(EXP_PAGE.storage.legacyValueKey).toBeUndefined();
  });

  it("formats like the game and models gains over the EXP groups", () => {
    expect(EXP_PAGE.formatTotal(1.4504214791708842e19)).toBe("14504214T");
    const G = `${EXP_ROOT} / ${EXP_GROUPS[1].name}`;
    expect(EXP_PAGE.gains.totalFromFlat({ [`${G} / EXP Bundle (bun_q)`]: 20 })).toBeCloseTo(1.2, 12);
  });

  it("loads the Observed Max for a class", async () => {
    const top = await EXP_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });

  it("keeps the six circumstantial sources out of the ranking, but still in the total", () => {
    expect(EXP_CIRCUMSTANTIAL_SOURCE_NAMES).toHaveLength(6);
    const G10 = `${EXP_ROOT} / ${EXP_GROUPS.find((g) => g.key === "g10")!.name}`;
    const yours: Record<string, number> = { [`${G10} / Normal Source`]: 5 };
    const ref: Record<string, number> = { [`${G10} / Normal Source`]: 5 };
    for (const name of EXP_CIRCUMSTANTIAL_SOURCE_NAMES) {
      yours[`${G10} / ${name}`] = 10;
      ref[`${G10} / ${name}`] = 999;
    }
    const rows = EXP_PAGE.gains.sources(yours, ref);
    for (const name of EXP_CIRCUMSTANTIAL_SOURCE_NAMES) {
      expect(rows.some((r) => r.source === name)).toBe(false);
    }
    // Still summed into the group total (pct group: raising them raises it).
    expect(EXP_PAGE.gains.totalFromFlat(ref)).toBeGreaterThan(EXP_PAGE.gains.totalFromFlat(yours));
  });

  it("doesn't rank the weekly vote (Vote 15)", () => {
    const G = `${EXP_ROOT} / ${EXP_GROUPS.find((g) => g.sources.includes("vote15"))!.name}`;
    const rows = EXP_PAGE.gains.sources({ [`${G} / ${EXP_VOTE_NAME}`]: 0 }, { [`${G} / ${EXP_VOTE_NAME}`]: 30 });
    expect(rows.some((r) => r.source === EXP_VOTE_NAME)).toBe(false);
  });

  it("methodology note explains why circumstantial sources aren't ranked", () => {
    expect(EXP_PAGE.methodologyNote).toContain("lowest-level character or below a level cap aren't ranked");
  });
});
