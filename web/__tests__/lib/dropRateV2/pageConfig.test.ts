import { describe, it, expect } from "vitest";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";
import { DR2_GROUPS, DR2_ROOT, DR2_VOTE_NAME } from "@/lib/arkh/stats/defs/drop-rate-v2";

// V1's localStorage keys (components/dropRate/{DrCalculator,SnapshotSection}.tsx, lib/dropRate/storage.ts).
const V1_KEYS = [
  "drop-rate-tracker.last-upload.v1",
  "drop-rate-tracker.playerName",
  "drop-rate-tracker.v1",
  "drop-rate.snapshot-section.collapsed.v1",
];

// One class per family, plus the two with their own talent profile.
const CLASSES = ["Beginner", "Journeyman", "Warrior", "Royal_Guardian", "Archer", "Mage"];

describe("Drop Rate V2 page config", () => {
  it("uses its own storage keys, none shared with V1 or with each other", () => {
    expect(DR2_PAGE.storage).toEqual({
      save: "drop-rate-v2-tracker.last-upload.v1",
      name: "drop-rate-v2-tracker.playerName",
      snapshots: "drop-rate-v2-tracker.v1",
      collapse: "drop-rate-v2.snapshot-section.collapsed.v1",
      exportPrefix: "drop-rate-v2-snapshots",
      exportLabel: "drop-rate-v2-tracker",
    });
    const keys = [DR2_PAGE.storage.save, DR2_PAGE.storage.name, DR2_PAGE.storage.snapshots, DR2_PAGE.storage.collapse];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(V1_KEYS).not.toContain(k);
    expect(DR2_PAGE.storage.legacyValueKey).toBeUndefined();
  });

  it("has a map selector (the map feeds the Arcane slot and the Cove)", () => {
    expect(DR2_PAGE.noMap).toBeUndefined();
  });

  it("loads the Observed Max, per class", async () => {
    const top = await DR2_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
    for (const c of CLASSES) expect(Object.keys(top.flatForClass(c)).length).toBeGreaterThan(0);
  });

  it("doesn't rank the weekly vote, while other sources of its group are ranked", async () => {
    const ref = (await DR2_PAGE.loadTop()).flatForClass("Warrior");
    const group = DR2_GROUPS.find((g) => g.sources.includes("vote27"))!.name;
    const vote = `${DR2_ROOT} / ${group} / ${DR2_VOTE_NAME}`;
    expect(ref[vote]).toBeGreaterThan(0); // the reference does carry the vote
    const rows = DR2_PAGE.gains.sources({ ...ref, [vote]: 0 }, ref); // yours lacks it → it would be a gain
    expect(rows.some((r) => r.source === DR2_VOTE_NAME)).toBe(false);
    expect(rows.some((r) => r.group === group && r.source !== DR2_VOTE_NAME)).toBe(true); // positive control
  });

  describe("Arcane toggle (refToggle)", () => {
    const arcane = DR2_GROUPS.find((g) => g.key === "arcane")!;

    it("is a direct child of the root and names the Arcane Map group", () => {
      const t = DR2_PAGE.refToggle!;
      expect(t.label).toBe("Include Arcane Map");
      expect(t.title).toBe("Include the Arcane Map multiplier in the Observed Max");
      expect(t.groupPath).toBe(`${DR2_ROOT} / ${arcane.name}`);
      expect(t.groupPath.split(" / ")).toHaveLength(2); // stripGroup replays the path's FIRST segment
      expect(t.groupPath.split(" / ")[0]).toBe(DR2_ROOT);
    });

    it.each(CLASSES)("is in the %s reference, so unchecking it removes something", async (c) => {
      const ref = (await DR2_PAGE.loadTop()).flatForClass(c);
      const p = DR2_PAGE.refToggle!.groupPath;
      expect(ref[p]).toBeGreaterThan(0);
      expect(Object.keys(ref).some((k) => k.startsWith(`${p} / `))).toBe(true);
    });
  });

  it.each(CLASSES)("totalFromFlat replays the %s reference to its own total", async (c) => {
    const ref = (await DR2_PAGE.loadTop()).flatForClass(c);
    const total = ref[DR2_ROOT];
    expect(Math.abs(DR2_PAGE.gains.totalFromFlat(ref) - total)).toBeLessThanOrEqual(1e-9 * total);
  });

  it("stripping the Arcane group lowers the reference total", async () => {
    const ref = (await DR2_PAGE.loadTop()).flatForClass("Warrior");
    const p = DR2_PAGE.refToggle!.groupPath;
    const stripped = Object.fromEntries(Object.entries(ref).filter(([k]) => k !== p && !k.startsWith(`${p} / `)));
    const without = DR2_PAGE.gains.totalFromFlat(stripped);
    expect(without).toBeGreaterThan(0);
    expect(without).toBeLessThan(ref[DR2_ROOT]);
  });
});
