import { describe, it, expect } from "vitest";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { EXP_GROUPS, EXP_ROOT } from "@/lib/arkh/stats/defs/exp-multi";

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
});
